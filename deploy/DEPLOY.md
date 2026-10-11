# Hosting BYU Calendar on a self-managed server (byucalendar.com)

Server: a colocated Linux box. This runbook uses `deploy@your-server` and
`/home/deploy/byucalendar`; adjust them to your own host. Root access is
limited to a scoped `/etc/sudoers.d/byucalendar` rule covering the five
`systemctl byucalendar` commands, so `deploy/update.sh` can run
non-interactively; delete that file to revoke.

Deploy target overrides live in `deploy/target.env` (git-ignored): set
`BYUC_SERVER`, `BYUC_KEY`, and `BYUC_DIR` there, or export them in the shell
before running the helper (shell values win).

## What is set up

| Piece | Location / detail |
| --- | --- |
| Node 22 | system install (`/usr/bin/node`) |
| App files | `/home/deploy/byucalendar/` (`dist/`, `data/seed.json`, `drizzle/`, `scripts/`, `runtime/` with the locked Wrangler + workerd runtime, `package.json`) |
| D1 database | `/home/deploy/byucalendar/.wrangler/state/` — accounts, sessions, bookmarks, listings, reports, source snapshots. **Back this up to preserve everything.** |
| Account env | `/home/deploy/byucalendar/.env.accounts` (mode 600) — auth secret, Resend key, admin allowlist, and the optional search-assist key. Values never enter Git. |
| Search assist key | `SEARCH_ASSIST_API_KEY` in the same `.env.accounts` — key for `POST /api/search/assist`, the natural-language search backup. Optional `SEARCH_ASSIST_BASE_URL` (default `https://api.deepseek.com`) and `SEARCH_ASSIST_MODEL` (default `deepseek-flash`). Without a key the endpoint reports unavailable and the calendar keeps its deterministic search. |
| systemd service | `/etc/systemd/system/byucalendar.service` (repo copy: `deploy/byucalendar-colo.service`) — wrangler local mode on `127.0.0.1:8788`, auto-restart, enabled at boot |
| Nginx vhost | `sites-available/byucalendar` (repo copy: `deploy/byucalendar.nginx.conf`) — 443 with a Let's Encrypt cert, gzip, proxy to 8788 |
| Auto refresh | crontab for the service user: hourly at :10 plus `7,27,47 * * * *`, both POST `/api/refresh` → `~/byucalendar/refresh.log` |
| Daily digest dispatch | same crontab: `2,17,32,47 * * * *` POST `/api/reminders/dispatch` with the `Origin` header and `Authorization: Bearer $REMINDERS_DISPATCH_TOKEN`; the endpoint only sends between 7:00 and 10:00 AM Mountain Time |

## Day-to-day operations

- **Deploy a code/data update** (from project root, Git Bash):

  ```bash
  bash deploy/update.sh
  ```

  It rebuilds locally, uploads, and restarts the service. D1 data survives;
  schema changes need a new migration applied with the staged runtime's
  `wrangler d1 execute` against `dist/server/wrangler.json` on the server. The
  helper validates the target path, installs the runtime before stopping the
  service, health-checks `127.0.0.1:8788/api/account`, and keeps the previous
  build/runtime for rollback when activation fails. It does not apply D1
  migrations automatically.

- **Logs:** `ssh -i ~/.ssh/id_rsa deploy@your-server 'journalctl -u byucalendar -f'`
  (sudo for full output); refresh results: `~/byucalendar/refresh.log`.
- **Restart:** `ssh -i ~/.ssh/id_rsa deploy@your-server 'sudo systemctl restart byucalendar'`
  (works without the password thanks to the scoped sudo rule).
- **Back up all data:** stop the service, copy `.wrangler/state/`, restart.
