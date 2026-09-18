# BYU Calendar

A campus event calendar built with React, Vinext, and Cloudflare D1, using the colors and typography of CareerLaunchpad.

- Week, month, and responsive agenda views
- Public BYU, Marriott, AIS, Accounting Society, and department imports with source provenance
- A dated snapshot of 119 public listings from 48 student organizations
- A reviewed snapshot of 227 Handshake event listings, with organizer details and original links
- Phrase-based smart search and grouped interest/detail filters
- Account-specific saved events and named filters
- BYU email verification with immediate community listings/tags and private reports
- iCalendar export
- Persistent snapshots and automatic source refresh on visits and while open

See [maintenance and setup](docs/MAINTENANCE.md) for development, data sources, refresh behavior, and current limitations.

See [account setup](docs/ACCOUNTS.md) for permissions, the database migration, and Resend configuration. The account feature is implemented locally; live email delivery and deployment are pending.

## Local preview

`npm run dev` (or `node scripts/run-framework.mjs dev` on this Windows installation)

## Verification

`npm test`, `node node_modules/typescript/bin/tsc --noEmit`, `npm run build`, then `npm run test:worker`.

## Hosting status

The existing calendar is self-hosted at https://byucalendar.com on a self-managed server, with Nginx, systemd, local D1 persistence, and a refresh cron every 20 minutes. See [the deployment runbook](deploy/DEPLOY.md). The older hosting manifest remains as historical setup data. Apply the account migration before deploying this release.
