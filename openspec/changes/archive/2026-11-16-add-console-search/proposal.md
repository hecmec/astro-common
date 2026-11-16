## Why

The console shows how many people visit the four sites, but not how they find them. Google Search Console knows how often each site appears in Google results (impressions), how often people click through, and for which searches. Today that means opening four Search Console properties one by one; the console was planned with a Search page from the start (see the archived `add-admin-console` change).

## What Changes

- New **Search** entry in the console's left menu and a `/search` page:
  - one line chart with the four sites' daily **clicks** (or **impressions**) from Google Search, over 7, 30 or 90 days, in the sites' colours, with each site's total for the period;
  - a **top searches** table for the same period: the searches that brought the most clicks, with their site, clicks, impressions, click-through rate and average position, for all sites or one (`?site=`);
  - a note that Search Console data arrives two to three days late, so the period ends on the latest day Google has published.
- The console reads Search Console with a Google Cloud **service account** that has read-only access to the four domain properties (`sc-domain:…`, already in `sites.yaml`). Its key is a server-side secret (`GOOGLE_SERVICE_ACCOUNT_JSON`), never sent to the browser. Without it, the Search page says the statistics are unavailable.
- Like Visits: works without JavaScript, a failing site is left out with a notice, figures are cached in memory (here for an hour), no database.

## Capabilities

### New Capabilities

- `console-search`: the Search page, Search Console as its source, its ranges, metrics, chart, totals, top searches and failures.

### Modified Capabilities

- `admin-console`: "Feature menu": the menu lists Comments, Visits and Search.

## Impact

- `services/console`: a Search Console client (service-account sign-in with `node:crypto`, no Google library), the Search page, the menu entry, tests and fakes, README.
- Configuration: new runtime variable `GOOGLE_SERVICE_ACCOUNT_JSON` on the Coolify `console` app.
- Google Cloud: a project with the Search Console API enabled and a service account; its email added as a restricted user to each of the four Search Console properties (done by the user).
- No new dependency; no change to the comments service or the sites.
