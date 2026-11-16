## Context

- The console (`services/console`, Astro SSR) already has the Visits page: `VisitsService` fetches the four sites in parallel, caches in memory, and `LineChart.astro` draws one SVG line per site with titled points, totals and a table view. The Search page follows the same pattern (spec `console-search`).
- `services/console/sites.yaml` already carries each site's Search Console property: `sc-domain:anglais-gratuit.org`, `sc-domain:simplygoodfood.eu`, `sc-domain:alt-web.org`, `sc-domain:bon-et-gratuit.fr`, all domain properties in one Google account.
- Search Console API, Search Analytics: `POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query` with `startDate`, `endDate` (YYYY-MM-DD), `dimensions` (`date`, `query`, …), `type: "web"`, `rowLimit`. Rows: `{ keys: [...], clicks, impressions, ctr, position }`. Dates are Pacific Time days; final data lags two to three days; days without impressions are left out; rows grouped by `query` leave out anonymised (rare) searches.
- Workspace rule: no new runtime dependency without approval; the console must stay stateless (archived `add-admin-console` design).

## Goals / Non-Goals

**Goals:** clicks and impressions for the four sites in one chart, top searches, with the same ranges, chart and behaviour as Visits; one secret, server side; no database.

**Non-Goals:** pages, countries or devices breakdowns; comparisons with the previous period; Bing Webmaster Tools; fresh (unfinished) data of the last two days; writing anything to Search Console.

## Decisions

### Service account, signed with `node:crypto`

The console signs in as a Google Cloud service account: a JWT (`RS256`, `iss` = the account's email, `scope` = `https://www.googleapis.com/auth/webmasters.readonly`, `aud` = `https://oauth2.googleapis.com/token`, one hour) signed with `crypto.createSign('RSA-SHA256')`, exchanged at the token endpoint (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`) for an access token, kept in memory until five minutes before it expires. The key comes from `GOOGLE_SERVICE_ACCOUNT_JSON` (the downloaded JSON key, raw or base64), checked at startup for `client_email` and `private_key`.

Alternatives: the `googleapis` package (large, many transitive dependencies, against the dependency policy); OAuth with the admin's own Google account (needs a stored refresh token and consent screen; the service account is simpler and read-only by construction).

### On-demand requests with a one-hour cache, no database

The exploration suggested a nightly sync into SQLite. Instead, the console asks Search Console when the page is opened and keeps the answers in memory for an hour:

- **Daily series**: one request per site, dimension `date`, over the last 100 days ending today; one answer covers all three ranges. Cached per site.
- **Latest day**: the latest date present in the four answers; each range ends on it (spec "Ranges and data delay"). Missing days inside the range count as zero.
- **Top searches**: per site and range, dimension `query`, `rowLimit: 25`, ordered by clicks. "All sites" merges the four lists and keeps the 25 with most clicks. Cached per site and range.

At most about 16 requests an hour, far below Search Console's quotas (1,200 a minute per property). A database would add a Coolify volume, migrations and a sync job for data that is cheap to ask again; the console stays stateless.

### Reuse the Visits building blocks

The chart is `LineChart.astro` with the unit `["click", "clicks"]` or `["impression", "impressions"]`. The range and metric links, the totals row and the table view follow the Visits page; the shared pieces (range parsing, totals row) move to small shared modules instead of being copied. Click-through rate is shown as a percentage with one decimal, position with one decimal.

### Failures per site

`Promise.allSettled` over the four sites, like Visits: a 403 for one property (not shared with the service account) or any error leaves that site out with a notice; all four failing, a failed token request or no key at all gives "Search statistics are unavailable". Failures are not cached.

### Test endpoints

For the browser tests, `SEARCH_CONSOLE_API_URL` and `GOOGLE_TOKEN_URL` can point the client at the fake upstream server; both are refused when `NODE_ENV=production`, so a production console only ever sends its signed assertion to Google.

## Risks / Trade-offs

- [The key is a long-lived secret] → Read-only scope, restricted user on four properties only; it lives in Coolify's variables and the git-ignored `.env`; revoked by deleting the key in Google Cloud.
- [Pacific Time days, Paris Time on Visits] → The page states that Search Console days are Google's (Pacific) days; the two pages are not compared day by day.
- [Top searches leave out rare queries] → The page says so (spec "Top searches").
- [The response shape of Search Console differs from the documentation] → The client is tested on responses recorded from the real API once the key exists, as was done for Umami.

## Migration Plan

1. The user creates the Google Cloud project, enables the Search Console API, creates the service account and a JSON key, and adds the account's email as a restricted user to the four properties; the key goes into the git-ignored `.env`.
2. Build and test; record real responses as fixtures.
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON` on the Coolify `console` app, release to `main`, check the page against Search Console's own reports.

Rollback: unset the variable (the page says unavailable) or revert the release.
