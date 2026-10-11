import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const hasBash = spawnSync(bash, ['--version'], {windowsHide: true}).status === 0;
const deploy = readFileSync(new URL('../deploy/update.sh', import.meta.url), 'utf8');
const activation = deploy.match(/<<'REMOTE'\r?\n([\s\S]*?)\r?\nREMOTE/)[1];
const fixtures = path.resolve('tmp/deploy-fixtures');

function fixture(t) {
  mkdirSync(fixtures, {recursive: true});
  const directory = mkdtempSync(path.join(fixtures, 'test-'));
  t.after(() => {
    // Only remove the temporary directory this test created inside the workspace.
    assert.equal(path.dirname(realpathSync(directory)), realpathSync(fixtures));
    rmSync(directory, {recursive: true, force: true});
  });
  const root = path.join(directory, 'app');
  const stage = path.join(root, 'release-stage-test');
  for (const folder of ['runtime', 'dist', 'data', '.wrangler/state', 'release-stage-test/runtime', 'release-stage-test/dist', 'release-stage-test/data']) mkdirSync(path.join(root, folder), {recursive: true});
  for (const folder of ['runtime', 'dist']) {
    writeFileSync(path.join(root, folder, 'marker'), 'previous');
    writeFileSync(path.join(stage, folder, 'marker'), 'new');
  }
  writeFileSync(path.join(root, '.wrangler/state/database'), 'persistent account data');
  writeFileSync(path.join(root, '.env.accounts'), 'private configuration fixture');
  for (const file of ['package.json', 'package-lock.json', 'data/seed.json']) writeFileSync(path.join(stage, file), '{}');
  const posixRoot = root.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
  return {directory, root, stage, posixRoot};
}

function activate(f, mode) {
  // Exercise the actual remote activation block with service/network calls
  // replaced by shell functions. No SSH, real systemctl, or real curl runs.
  const stubs = `
sudo() { "$@"; }
systemctl() { printf '%s\\n' "$*" >> "$TEST_SERVICE_LOG"; }
curl() { [[ "$TEST_ACTIVATION_MODE" != unhealthy ]]; }
sleep() { :; }
mv() {
  if [[ "$TEST_ACTIVATION_MODE" == move-failure && "$1" == */release-stage-test/dist ]]; then
    return 1
  fi
  command mv "$@"
}
`;
  const scriptPath = path.join(f.directory, 'activate.sh');
  writeFileSync(scriptPath, stubs + activation);
  return spawnSync(bash, [scriptPath.replaceAll('\\', '/'), f.posixRoot, 'test'], {
    encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: {...process.env, TEST_ACTIVATION_MODE: mode, TEST_SERVICE_LOG: path.join(f.directory, 'service.log').replaceAll('\\', '/')},
  });
}

test('deployment activates a healthy build and locked runtime together without moving account state', {skip: !hasBash}, t => {
  const f = fixture(t);
  const result = activate(f, 'healthy');
  assert.equal(result.status, 0, result.stderr);
  for (const folder of ['runtime', 'dist']) {
    assert.equal(readFileSync(path.join(f.root, folder, 'marker'), 'utf8'), 'new');
    assert.equal(readFileSync(path.join(f.root, 'release-backup-test', folder, 'marker'), 'utf8'), 'previous');
  }
  assert.equal(readFileSync(path.join(f.root, '.wrangler/state/database'), 'utf8'), 'persistent account data');
  assert.equal(readFileSync(path.join(f.root, '.env.accounts'), 'utf8'), 'private configuration fixture');
  assert.equal(readFileSync(path.join(f.directory, 'service.log'), 'utf8'), 'stop byucalendar\nstart byucalendar\nis-active --quiet byucalendar\n');
});

for (const mode of ['unhealthy', 'move-failure']) {
  test(`deployment restores the previous build and runtime after ${mode}`, {skip: !hasBash}, t => {
    const f = fixture(t);
    const result = activate(f, mode);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /restored the previous build and runtime/);
    for (const folder of ['runtime', 'dist']) assert.equal(readFileSync(path.join(f.root, folder, 'marker'), 'utf8'), 'previous');
    assert.equal(readFileSync(path.join(f.stage, 'failed-runtime/marker'), 'utf8'), 'new');
    assert.equal(existsSync(path.join(f.stage, 'failed-dist')), mode === 'unhealthy');
    assert.equal(readFileSync(path.join(f.root, '.wrangler/state/database'), 'utf8'), 'persistent account data');
    assert.equal(readFileSync(path.join(f.root, '.env.accounts'), 'utf8'), 'private configuration fixture');
  });
}

test('deployment rejects unsafe remote paths before invoking build or upload commands', {skip: !hasBash}, () => {
  execFileSync(bash, ['-n', 'deploy/update.sh'], {windowsHide: true});
  for (const directory of ['/tmp/app', '/home/user/app/../other', '/home/user/app/..', '/home/user/app;touch marker']) {
    const result = spawnSync(bash, ['-c', 'node() { exit 99; }; ssh() { exit 99; }; scp() { exit 99; };\n' + deploy], {
      encoding: 'utf8', windowsHide: true, timeout: 10000, env: {...process.env, BYUC_DIR: directory},
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /BYUC_DIR must/);
  }
});
