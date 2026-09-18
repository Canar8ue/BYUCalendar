# Hosting BYU Calendar on the co-located server (byucalendar.com)

Server: `deploy@203.0.113.10` (SSH key `~/.ssh/id_rsa`; sudo password
required except for the five `systemctl byucalendar` commands covered by
`/etc/sudoers.d/byucalendar`). The box also hosts service-a, service-b, and
service-c — **never touch their PM2 processes, directories, or nginx
vhosts** (`service-a`, `service-b`, `service-c`), and never run
`pm2 restart all`.

Moved here September 16, 2026 from the GCP e2-micro (which swap-thrashed at
1 GB RAM); migration runbook and history: [deploy notes](deploy notes).

## What is set up (September 16, 2026)

| Piece | Location / detail |
| --- | --- |
| Node 22.22.1 | `/usr/bin/node` (system install; already present for service-a) |
| App files | `/home/deploy/byucalendar/` (`dist/`, `data/seed.json`, `drizzle/`, `scripts/`, `runtime/` with the locked Wrangler 4.92 + workerd runtime, `package.json`) |
| D1 database | `/home/deploy/byucalendar/.wrangler/state/` — accounts, sessions, bookmarks, listings, reports, source snapshots. **Back this up to preserve everything.** |
| Account env | `/home/deploy/byucalendar/.env.accounts` (mode 600) — auth secret, Resend key, admin allowlist. Same secret as before the move, so sessions survived. |
| systemd service | `/etc/systemd/system/byucalendar.service` (repo copy: `deploy/byucalendar-colo.service`) — wrangler local mode on `127.0.0.1:8788`, auto-restart, enabled at boot |
| Nginx vhost | `sites-available/byucalendar` (repo copy: `deploy/byucalendar.nginx.conf`, with `http2 on;` syntax for nginx 1.28) — 443 with Let's Encrypt cert, gzip, proxy to 8788 |
| TLS cert | `/etc/letsencrypt/live/byucalendar.com/` — copied from the old server at migration; `certbot renew --dry-run` verified working here (the box renews three other certs too; all passed) |
| Auto refresh | crontab for `deploy`: hourly at :10 plus `7,27,47 * * * *`, both POST `/api/refresh` → `~/byucalendar/refresh.log` |
| Passwordless sudo | `/etc/sudoers.d/byucalendar` — only `systemctl {restart,is-active,status,start,stop} byucalendar`, so `deploy/update.sh` works non-interactively. Delete the file to revoke. |

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

- **Logs:** `ssh -i ~/.ssh/id_rsa deploy@203.0.113.10 'journalctl -u byucalendar -f'`
  (sudo for full output); refresh results: `~/byucalendar/refresh.log`.
- **Restart:** `ssh -i ~/.ssh/id_rsa deploy@203.0.113.10 'sudo systemctl restart byucalendar'`
  (works without the password thanks to the scoped sudo rule).
- **Back up all data:** stop the service, copy `/home/deploy/byucalendar/.wrangler/state/`, restart.

## Previous host (rollback reference)

The GCP e2-micro `deploy@203.0.113.11` (key `~/.ssh/id_mc_python`) kept its
copy of the app and D1 state, with `byucalendar.service` **stopped** since the
September 16 cutover. It still hosts portfolio-site.co and client-site —
do not decommission that instance. Rollback (first week only, before data
diverges): point the Cloudflare A record back to `203.0.113.11` and
`sudo systemctl start byucalendar` there. Once confident, disable it there
(`sudo systemctl disable --now byucalendar` and remove its crontab entries).
