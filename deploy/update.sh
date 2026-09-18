#!/usr/bin/env bash
# Redeploy BYU Calendar to its isolated directory on the co-located server.
# Usage (from project root, Git Bash): bash deploy/update.sh
# Stages the build and locked runtime before stopping the service. Keeps the
# previous build/runtime together for rollback; never moves persistent D1 state.
# D1 data in ~/byucalendar/.wrangler/state is preserved across deploys.
set -euo pipefail

# Target server is overridable (see deploy/deploy notes for history):
# byucalendar.com moved to the co-located box on September 16, 2026.
SERVER="${BYUC_SERVER:-deploy@203.0.113.10}"
KEY="${BYUC_KEY:-$HOME/.ssh/id_rsa}"
REMOTE_DIR="${BYUC_DIR:-/home/deploy/byucalendar}"

# Remote paths are interpolated into SSH commands; accept only absolute paths
# under a home directory and reject traversal or shell metacharacters.
if [[ ! "$REMOTE_DIR" =~ ^/home/[A-Za-z0-9_-]+/[A-Za-z0-9_./-]+$ || "$REMOTE_DIR" == *'/../'* || "$REMOTE_DIR" == */.. ]]; then
  echo "BYUC_DIR must be an absolute app directory under /home with no traversal." >&2
  exit 1
fi
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-$$"
STAGE="$REMOTE_DIR/release-stage-$RELEASE"

echo "== Building =="
node scripts/run-framework.mjs build

echo "== Uploading =="
ssh -i "$KEY" "$SERVER" "mkdir -p '$STAGE/runtime' '$STAGE/data'"
scp -i "$KEY" -r dist "$SERVER:$STAGE/"
scp -i "$KEY" deploy/runtime/package.json deploy/runtime/package-lock.json "$SERVER:$STAGE/runtime/"
scp -i "$KEY" data/seed.json "$SERVER:$STAGE/data/"
scp -i "$KEY" package.json package-lock.json "$SERVER:$STAGE/"

echo "== Installing the locked server runtime =="
ssh -i "$KEY" "$SERVER" "cd '$STAGE/runtime' && npm ci --omit=dev --no-audit --no-fund && node node_modules/wrangler/bin/wrangler.js --version"

echo "== Activating the release =="
ssh -i "$KEY" "$SERVER" bash -s -- "$REMOTE_DIR" "$RELEASE" <<'REMOTE'
set -euo pipefail
root="$(realpath -e -- "$1")"
stage="$root/release-stage-$2"
backup="$root/release-backup-$2"
# Check resolved targets before any directory moves. Existing runtime/dist
# must be real directories in this app, not symlinks into another service.
for path in "$root/runtime" "$root/dist" "$root/data" "$stage" "$stage/runtime" "$stage/dist" "$stage/data"; do
  [[ -d "$path" && ! -L "$path" && "$(realpath -e -- "$path")" == "$path" ]] || exit 1
done
[[ ! -e "$backup" ]]
mkdir "$backup"
runtime_saved=0; dist_saved=0; success=0
rollback() {
  if (( ! success )); then
    sudo systemctl stop byucalendar || true
    if (( runtime_saved )); then
      [[ ! -d "$root/runtime" ]] || mv "$root/runtime" "$stage/failed-runtime"
      mv "$backup/runtime" "$root/runtime"
    fi
    if (( dist_saved )); then
      [[ ! -d "$root/dist" ]] || mv "$root/dist" "$stage/failed-dist"
      mv "$backup/dist" "$root/dist"
    fi
    sudo systemctl start byucalendar
    echo 'Activation failed; restored the previous build and runtime.' >&2
  fi
}
trap rollback EXIT
sudo systemctl stop byucalendar
mv "$root/runtime" "$backup/runtime"; runtime_saved=1
mv "$root/dist" "$backup/dist"; dist_saved=1
mv "$stage/runtime" "$root/runtime"
mv "$stage/dist" "$root/dist"
sudo systemctl start byucalendar
for attempt in {1..30}; do
  if systemctl is-active --quiet byucalendar && curl --fail --silent --max-time 5 http://127.0.0.1:8788/api/account > /dev/null; then
    success=1
    break
  fi
  sleep 1
done
(( success ))
cp "$stage/package.json" "$stage/package-lock.json" "$root/"
cp "$stage/data/seed.json" "$root/data/seed.json"
cp "$stage/data/seed.json" "$root/seed.json"
echo "Active. Previous build and runtime: $backup"
REMOTE

echo "Done. Verify: https://byucalendar.com/"
