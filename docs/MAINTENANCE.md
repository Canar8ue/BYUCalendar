# BYU Calendar

A private calendar app inspired by the user's CareerLaunchpad design system: Archivo, Roboto, Roboto Mono, Material colors, and hard bordered cards.

## What is connected

`lib/catalog.mjs` defines the public source allowlist. Twenty live sources are configured: BYU Events; nine Marriott feeds; AIS; Accounting Society; Engineering; Mathematics; Computer Science; ACME; Life Sciences; Kennedy Center; BYU Law; and Marketing Association. Fourteen currently publish upcoming events. A separate, clearly labeled BYU Student Organizations snapshot adds 119 listings from 48 clubs collected on September 14, 2026. Handshake, AIS Slack, social account imports, and Beta Alpha Psi remain unconnected.

`lib/source-import.mjs` imports ICS feeds, enriches BYU Brightspot calendar records from their public Events JSON endpoints, and follows dated event listings to their published per-event ICS downloads. It never derives dates from URL slugs, which are often stale. Math and Life Sciences feeds syndicate the main BYU calendar; only records linking to the department's own hostname are added as department records. Sources and event URLs remain linked in the UI. See [the source audit](SOURCE_AUDIT.md) for exact URLs, coverage, and gaps.

`node scripts/refresh-seed.mjs` refreshes the distributable public snapshots using the same adapters as the app, preserving previous snapshots on failure. It does not update the manually collected club directory snapshot. `node scripts/import-club-snapshot.mjs <capture.json>` imports public browser-observed club rows with an explicit calendar year and capture date; uncertain food, end-time, and attendance fields stay unknown. The raw capture format is `{capturedAt, calendarYear, rows: [{title, organization, date, location}], details?: [{url, snapshot}]}`. These snapshots do not refresh automatically. New manual captures update existing installations only when their import timestamp is newer. Listing-only bookmark IDs depend on title, club, and start, so rescheduling may change them.

The checked-in `data/seed.json` contains real source snapshots for the first load. It is not demo data. D1 stores current snapshots, source check times, errors, and refresh leases. A successful refresh replaces that source's snapshot atomically, so edits and explicit cancellations take effect. Failed imports retain the previous snapshot. Matching titles and starts are merged, including an optional BYU prefix, while generic opening/closing socials from different organizations remain separate. Richer descriptions and additional source links are retained.

## Automatic updates

The browser calls `POST /api/refresh` on opening and every five minutes while open. Each source is refreshed at most hourly, or every five minutes when a visitor explicitly requests a refresh. Failed sources retry after 15 minutes. Database leases prevent concurrent imports of the same source. Sources are fetched sequentially with timeouts and streaming size bounds. Website adapters allow three concurrent detail downloads, a 90-second deadline, at most eight listing pages and 120 event links, with same-origin links only. A failed detail page retains its previous events; an unexpected listing structure fails without replacing the source snapshot. The club directory snapshot is excluded from live refresh. Metadata enrichment failure does not remove the calendar inventory.

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

Checks: `node --test tests/calendar.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, and the production build. The tests cover Denver offsets, rescheduling identity, recurrence exceptions, multi-day overlap, missing/negated details, search, club tagging, duplicate provenance, website imports with stale URL dates, origin bounds, partial source failures, snapshot dates, and valid exports.
