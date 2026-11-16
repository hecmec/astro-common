## 1. Google Cloud access (user, with guidance)

- [x] 1.1 Create a Google Cloud project (or reuse one), enable the "Google Search Console API", create a service account and a JSON key; add the account's email as a **Restricted** user to the four properties (Search Console → Settings → Users and permissions); put the key in the git-ignored `.env` as `GOOGLE_SERVICE_ACCOUNT_JSON`; verify a read-only test request lists the four `sc-domain:` properties with permission `siteRestrictedUser`

## 2. Search Console client

- [x] 2.1 Config: optional `GOOGLE_SERVICE_ACCOUNT_JSON` (raw JSON or base64; `client_email` and `private_key` required), `SEARCH_CONSOLE_API_URL` and `GOOGLE_TOKEN_URL` overrides refused in production; verify config tests (missing key, invalid key, overrides in production)
- [x] 2.2 Service-account sign-in: RS256 JWT with `node:crypto`, token exchange, token kept until five minutes before expiry, one shared sign-in for parallel requests; verify unit tests with a generated RSA key (signature verifies, claims, token reuse and renewal, failed exchange)
- [x] 2.3 Search Analytics queries: daily series (dimension `date`) and top searches (dimension `query`, `rowLimit` 25) per property, property URL-encoded, errors per status; verify unit tests on recorded responses (task 5.2) and on 403/500 answers

## 3. Search data

- [x] 3.1 Shared range parsing and totals with Visits (no copy); verify the Visits tests still pass
- [x] 3.2 `SearchService`: latest day across the four sites, 7/30/90-day windows ending on it, missing days as zero, totals per metric, top searches per site and merged for all sites (25 by clicks), failures per site, one-hour cache without caching failures; verify unit tests with a fake clock against the `console-search` scenarios

## 4. Search page

- [x] 4.1 `/search` page: range, metric and site choices in the address, chart (`LineChart`), totals legend, "data up to <day>" and delay note, top searches table with site badge, CTR and position, privacy note, notices for a failed site and "Search statistics are unavailable"; verify component and page tests
- [x] 4.2 Menu entry "Search" after Visits in the console layout; verify the layout test and the `admin-console` "Search in the menu" scenario

## 5. Tests, fixtures and docs

- [x] 5.1 Fake Google token endpoint and Search Analytics in `e2e/fakes.ts` (one property refused on the failing instance, all down on another); browser tests for the `console-search` scenarios, with JavaScript off too, and that no key, token or service-account email appears in the HTML; verify `pnpm --filter @babelcoach/console test:e2e`
- [x] 5.2 Record real Search Analytics responses for two sites (date and query dimensions) as fixtures, without tokens; verify the client tests on them
- [x] 5.3 README: Search page, service-account setup, `GOOGLE_SERVICE_ACCOUNT_JSON`, quotas and cache; verify `pnpm check` and `pnpm test` pass

## 6. Release

- [x] 6.1 Set `GOOGLE_SERVICE_ACCOUNT_JSON` on the Coolify `console` app, commit on `develop`, then (when asked) release to `main`; verify the deployment is healthy and the Search totals match Search Console's own Performance report for the same days
