# BYU Calendar

A private calendar app inspired by the user's CareerLaunchpad design system: Archivo, Roboto, Roboto Mono, Material colors, and hard bordered cards.

## What is connected

`lib/catalog.mjs` defines the allowlisted public feeds. BYU's all-events iCalendar feed supplies the main inventory, and the Events JSON API enriches descriptions and tags. Nine Marriott Google Calendar feeds are checked as well. Currently five sources have upcoming records; the public BS IS and MISM feeds are empty or outdated. Handshake, AIS Slack, Instagram, and Facebook are clearly marked as unconnected. No private content is imported.

The checked-in `data/seed.json` contains real source snapshots for the first load. It is not demo data. D1 stores current snapshots, source check times, errors, and refresh leases. A successful refresh replaces that source's snapshot atomically, so edits and explicit cancellations take effect. Failed imports retain the previous snapshot. Only exact normalized title and start matches are merged; uncertain matches remain separate.

## Automatic updates

The browser calls `POST /api/refresh` on opening and every five minutes while open. Each source is refreshed at most hourly, or every five minutes when a visitor explicitly requests a refresh. Failed sources retry after 15 minutes. Database leases prevent concurrent imports of the same source. Sources are fetched sequentially with timeouts and size bounds. Metadata enrichment failure does not remove the calendar inventory.

**No unattended scheduler is provisioned.** The app refreshes on the next visit after an idle period. The deployment cannot be treated as a public cron endpoint. To run while no visitor is present, add an authenticated scheduler supported by the chosen hosting environment, call the same `refreshCalendar` service, and update the source panel's explanation only after that job is actually configured and tested. Do not store private calendar tokens in client code or in this source registry.

## Search and data quality

Smart search is a deterministic phrase parser, with no paid AI API or API key required. It understands the supported date ranges, after-time phrases, interests, food, and attendance format; remaining terms are matched against the event text. It is not unrestricted semantic or fuzzy search. Topic tags are derived from source metadata and text. Food and audience details require source evidence; unknown fields remain unknown. Literal nulls and explicit negative statements are handled. Calendar time is America/Denver, including daylight saving time. Multi-day all-day events treat the source end date as exclusive. Recurring rules and exception dates are expanded with ical.js.

## Saved calendars

The app uses account identity for account-specific bookmarks and saved filters. User records are stored in D1 by stable user ID. Local preview sign-in is simulated by the starter; production uses the platform's real identity. Source records that disappear entirely from a feed may cease to appear in saved calendars; the app does not maintain a historical archive of removed records. Downloads are ordinary `.ics` snapshots, not live external subscriptions.

## Development

Use Node 22.13+ and the package lockfile. Run `npm run install:ci`, `npm run db:generate` after schema changes, and `npm run dev`. On this Windows host the tooling wrapper's npm shim could not resolve npm, so direct `node scripts/run-framework.mjs dev` and `node scripts/run-framework.mjs build` were used successfully. The underlying npm CLI is at `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`.

Local D1 migrations use the built config:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_scarlet_spider.sql
```

Do not replay applied production migrations. Generate new migrations for schema changes. Source setup, packaging, and deployment use the build workflow and the existing build manifest.

Checks: `node --test tests/calendar.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, and the production build. The tests cover Denver offsets, rescheduling identity, recurrence exceptions, multi-day overlap, missing/negated details, search, duplicate provenance, and valid exports.
