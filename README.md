# BYU Calendar

A campus event calendar built with React, Vinext, and Cloudflare D1, using the colors and typography of CareerLaunchpad.

- Week, month, and responsive agenda views
- Public BYU, Marriott, AIS, Accounting Society, and department imports with source provenance
- A dated snapshot of 119 public listings from 48 student organizations
- Phrase-based smart search and grouped interest/detail filters
- Account-specific saved events and named filters
- iCalendar export
- Persistent snapshots and automatic source refresh on visits and while open

See [maintenance and setup](docs/MAINTENANCE.md) for development, data sources, refresh behavior, and current limitations.

## Local preview

`npm run dev` (or `node scripts/run-framework.mjs dev` on this Windows installation)

## Verification

`npm test`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run build`.

## Hosting status

An early hosted project was created during setup. When publishing, both the credential-renewal and deployment operations returned project-not-found, and the preview listing was empty. The original project ID remains unchanged in the hosting manifest for recovery. No production deployment has been confirmed. Do not recreate or replace the project identity without resolving its status.
