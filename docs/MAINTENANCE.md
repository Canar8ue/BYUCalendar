# BYU Calendar

A private calendar app inspired by the user's CareerLaunchpad design system: Archivo, Roboto, Roboto Mono, Material colors, and hard bordered cards.

## What is connected

`lib/catalog.mjs` defines the source registry; live adapters use a public source allowlist. Twenty live sources are configured: BYU Events; nine Marriott feeds; AIS; Accounting Society; Engineering; Mathematics; Computer Science; ACME; Life Sciences; Kennedy Center; BYU Law; and Marketing Association. Fourteen currently publish upcoming events. A separate, clearly labeled BYU Student Organizations snapshot adds 119 listings from 48 clubs collected on September 14, 2026. A reviewed Handshake snapshot adds 227 event listings imported September 14, 2026 (224 additional calendar entries after merging). AIS Slack, social account imports, and Beta Alpha Psi remain unconnected.

`lib/source-import.mjs` imports ICS feeds, enriches BYU Brightspot calendar records from their public Events JSON endpoints, and follows dated event listings to their published per-event ICS downloads. It never derives dates from URL slugs, which are often stale. Math and Life Sciences feeds syndicate the main BYU calendar; only records linking to the department's own hostname are added as department records. Sources and event URLs remain linked in the UI. See [the source audit](SOURCE_AUDIT.md) for exact URLs, coverage, and gaps.

`node scripts/refresh-seed.mjs` refreshes the distributable public snapshots using the same adapters as the app, preserving previous snapshots on failure. It preserves both the club directory and Handshake snapshots without refreshing them. `node scripts/import-club-snapshot.mjs <capture.json>` imports public browser-observed club rows with an explicit calendar year and capture date; uncertain food, end-time, and attendance fields stay unknown. The raw capture format is `{capturedAt, calendarYear, rows: [{title, organization, date, location}], details?: [{url, snapshot}]}`. These snapshots do not refresh automatically. New manual captures update existing installations only when their import timestamp is newer. Listing-only bookmark IDs depend on title, club, and start, so rescheduling may change them.

The checked-in `data/seed.json` contains real source snapshots for the first load. It is not demo data. D1 stores current snapshots, source check times, errors, and refresh leases. A successful refresh replaces that source's snapshot atomically, so edits and explicit cancellations take effect. Failed imports retain the previous snapshot. Matching titles and starts are merged, including an optional BYU prefix, while generic opening/closing socials from different organizations remain separate. A second pass collapses same-day near-duplicates the exact key cannot catch: identical titles with start drift of at most 30 minutes, one title's words contained in a longer variant (holidays, "Grad School Fair"/"Graduate School Fair"), and double-posted listings with near-identical wording. Audience variants such as the Melaleuca "Break-out room; GSCM" vs "; Marketing" sessions stay separate because their distinguishing tokens differ. Each collapsed group keeps the record with the most source-provided content (snapshot provenance boilerplate is ignored when comparing descriptions), unions the tags and source links, and fills missing fields. Richer descriptions and additional source links are retained.

## Handshake snapshot imports

Run `node scripts/import-handshake-snapshot.mjs Handshake/handshake_events_complete.json` after reviewing a new export. The input is a non-empty JSON array of event objects with `id`, `title`, `host`, `startDate`, `endDate`, `roomAndBuilding`, `locationSummary`, `cityState`, and `url`. Starts require explicit timezone offsets; valid timestamps become UTC instants and display in Mountain Time. The importer copies only listing fields, validates credential-free event links against the event ID, fails on invalid starts or conflicting IDs before changing the seed, and withholds invalid/missing end times. Exact duplicate IDs collapse. Source IDs remain stable when events move.

The supplied file has 227 unique IDs covering September 14, 2026 through March 18, 2027. Its 14 “Virtual / TBD” placeholders do not establish online attendance; 39 other venues are “To Be Determined.” The one equal start/end time is withheld. Hosts marked N/A stay unknown; Acc/MAcc, Fin, IS, and CS in titles support the corresponding interest filters. Fees, food, and eligibility are not assumed. Every imported listing carries an import-date notice and a Handshake link that may require sign-in. The original capture time and live source update times are absent, so sourceUpdated remains null.

Only reviewed, normalized listings enter the shared seed and D1 snapshots. Raw account exports in `Handshake/` are ignored by Git. No account tokens, attendees, or appointments were found in the supplied input; a future export still needs review. This does not connect a Handshake account or provide live synchronization. Later imports replace the stored snapshot when their import timestamp is newer. Matching titles/starts merge while retaining distinct original links, including duplicates within Handshake.

## Automatic updates

The browser calls `POST /api/refresh` on opening and every five minutes while open. Each source is refreshed at most hourly, or every five minutes when a visitor explicitly requests a refresh. Failed sources retry after 15 minutes. Database leases prevent concurrent imports of the same source. Sources are fetched sequentially with timeouts and streaming size bounds. Website adapters allow three concurrent detail downloads, a 90-second deadline, at most eight listing pages and 120 event links, with same-origin links only. A failed detail page retains its previous events; an unexpected listing structure fails without replacing the source snapshot. The club directory and Handshake snapshots are excluded from live refresh. Metadata enrichment failure does not remove the calendar inventory.

The existing self-hosted server has a cron job calling the local refresh endpoint every 20 minutes, so live sources also update while no visitor is present. See [the deployment runbook](../deploy/DEPLOY.md). Other local previews refresh on visits and while open. Do not store private calendar tokens in client code or in the source registry.

## Search and data quality

Smart search is a deterministic phrase parser, with no paid AI API or API key required. It understands the supported date ranges, after-time phrases, interests, food, and attendance format; remaining terms are matched against the event text. It is not unrestricted semantic or fuzzy search. "Free food" and food words map to the "Food provided" filter; the separate "Free food" tag was retired on September 15, 2026 because it duplicated "Food provided" on every record that carried it. Topic tags are derived from source metadata and text. Food and audience details require source evidence; unknown fields remain unknown. Literal nulls and explicit negative statements are handled. Calendar time is America/Denver, including daylight saving time. Multi-day all-day events treat the source end date as exclusive. Recurring rules and exception dates are expanded with ical.js.

## Search engine visibility

The app ships SEO basics from `app/layout.tsx` and static files in `public/`: a canonical URL, Open Graph and Twitter card metadata, `robots.txt` (which also excludes the sign-in, account, moderation, listing, and API paths), `sitemap.xml` for the homepage, `site.webmanifest`, PNG icons, a 1200×630 `og-image.png`, and JSON-LD structured data (Organization + WebSite with a search action pointing at `/?q={term}`). Regenerate only the social preview with `node scripts/generate-og-image.mjs`; its path-only vector master is `logos/svg/69-banner-og-campus.svg`, rendered with Sharp at exactly 1200×630 without installed fonts. The September 16 design uses bold typography and a weekly calendar illustration. `node scripts/generate-seo-images.mjs` calls the same OG renderer and also regenerates the icon fallbacks. The metadata assumes the production origin `https://byucalendar.com`. Search Console ownership verification and indexing happen outside the repository.

## Saved calendars

The account implementation uses Better Auth with BYU email verification through Resend. Bookmarks and saved filters use the verified account’s stable ID in D1. Mock sign-in is disabled; legacy headers are not trusted. Existing preferences under old identity IDs are not automatically reassigned. The account release is active on the self-hosted server; the current local security fixes and the pending privacy/event-dialog refinements still need deployment. See [account setup](ACCOUNTS.md) for permissions, the required migration, and activation steps. Source records that disappear entirely from a feed may cease to appear in saved calendars; the app does not maintain a historical archive of removed records. Downloads are ordinary `.ics` snapshots, not live external subscriptions.

## Security review

The September 17, 2026 source and local-runtime review is recorded in
[SECURITY_REVIEW.md](SECURITY_REVIEW.md). Keep the lockfile, the separate
`deploy/runtime/` Wrangler lockfile, and the bounded importer/export tests in
sync when dependencies or server-side routes change. The review fixes were
deployed on September 17 and verified at the public origin; rotate the Resend
key separately before considering account operations fully remediated.

## Development

### 3D campus map assets and matching

Deployed September 16, 2026 to byucalendar.com. Search/filter changes automatically frame matching pins. Building selection opens the event dialog only after the camera reports its completed flight; cancelled flights do not open stale dialogs.

The secondary Map view uses `app/campus-map.tsx` and the isolated, same-origin Three.js viewer in `public/campus/`. The GLB and `coordinates.json` are a paired export from the user's BYUCampus Blender project; replace both together. Retain `ATTRIBUTION.md` and vendor licenses. Rebuild the lookup with `node scripts/index-campus-locations.mjs` after replacing coordinates. The checked-in lookup groups building parts and excludes planned/unverified features. Venue aliases belong in `lib/campus-map.mjs`; add only aliases with known campus anchors, then run `tests/campus-map.test.mjs`.

Counts, category rings, location dialogs, and exports use the existing filtered daily events in America/Denver, including multi-day events. URL parameters `view=map`, `date=YYYY-MM-DD`, and `place=<catalog id>` preserve map state alongside existing filters. The iframe validates message origin/source, loads local assets only on demand, and renders on interaction. Location cards remain available if WebGL fails. Unknown/online/off-campus venues stay accessible in the unpinned day list; do not guess their coordinates from an event title or organizer.

Browser smoke checks: toggle Map, change day, apply category/detail/search filters, click a count and a building, follow “See on Map” from an event, reload its URL, and check phone width. Nearby pins use collision spacing and leader lines; confirm each count selects its own venue after camera movement.

Use Node 22.13+ and the package lockfile. Run `npm run install:ci`, `npm run db:generate` after schema changes, and `npm run dev`. On this Windows host the tooling wrapper's npm shim could not resolve npm, so direct `node scripts/run-framework.mjs dev` and `node scripts/run-framework.mjs build` were used successfully. The underlying npm CLI is at `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`.

Local D1 migrations use the built config:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_scarlet_spider.sql
```

A fresh database also needs `drizzle/0001_byu_accounts_community.sql` using the same command with that filename. Existing databases need only migrations not already applied. Do not replay applied production migrations. The account preview uses separate `.wrangler/accounts-preview` state. Production runs on the self-managed server; see [deployment](../deploy/DEPLOY.md) and the account guide before deploying schema changes.

Checks: `npm test`, `node node_modules/typescript/bin/tsc --noEmit`, the production build, then `npm run test:worker`. Run `node --test tests/deploy.test.mjs` when changing the release helper. Account tests use isolated D1; the built Worker tests intercept Resend and never email a real inbox. The tests cover Denver offsets, rescheduling identity, recurrence exceptions, multi-day overlap, missing/negated details, search, club tagging, duplicate provenance, website imports with stale URL dates, origin bounds, partial source failures, snapshot dates, Handshake date/URL validation, ambiguous locations, stable IDs, field allowlisting, valid exports, bounded redirects, request sizes, export injection, authorization races, and deployment rollback.
