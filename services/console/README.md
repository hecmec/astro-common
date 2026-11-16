# Console

The BabelCoach admins run the four sites from here: Alt Web, Simply Good Food, Anglais gratuit and Bon et gratuit. It is an Astro app rendered on the server for every request (Node adapter, standalone). Specs: `admin-console`, `console-visits`, `console-search`, plus the comments specs it uses (`comment-moderation`, `site-rebuild`, `comment-admin-api`) in [openspec](../../openspec).

| Page | What |
| --- | --- |
| `/comments` | Moderation of the four sites: status tabs with counts, filters by site (`?site=alt-web`) and page (`?path=/x/`), publish, refuse/unpublish, sticky, public reply, block a reader; the site rebuild status and "Rebuild changed sites now". Every action is a plain form post and comes back to the same tab and filters |
| `/visits` | One chart with the four sites' daily visitors or pageviews over 7, 30 or 90 days (`?range=90&metric=pageviews`), from Umami; totals per site; a table view |
| `/search` | Google Search clicks or impressions of the four sites in one chart over 7, 30 or 90 days ending on Search Console's latest published day (`?range=7&metric=impressions`), totals, a table view, and the top 25 searches of all sites or one (`?site=alt-web`) |
| `/links` | The four sites on staging and in production, two columns, each link in a new tab; an "Open all 4" button per environment opens the four sites in new tabs (browsers block all but the first tab until pop-ups are allowed for the console; the page says so) |
| `/healthz` | Health check, no sign-in |

The left menu shows the number of pending comments. Everything works without JavaScript; `/chart.js` only adds a crosshair tooltip to the chart.

## How it works

- **Comments**: the console calls the comments service's admin API (`/api/admin/v1`, see [its README](../comments/README.md#admin-api)) from its server, with the shared `CONSOLE_TOKEN`. The browser never talks to the comments service.
- **Visits**: the console logs in to Umami v3 (`POST /api/auth/login`) with a view-only account, keeps the token in memory (logs in again once on a 401), and reads `GET /api/websites/<id>/pageviews?unit=day&timezone=Europe/Paris` for each site in parallel. Results stay 5 minutes in memory per range. A site that fails is left out with a notice; Umami down shows "Visit statistics are unavailable". "Visitors" are Umami's sessions per day.
- **Search**: the console signs in to Google as a service account (an RS256 JWT signed with `node:crypto`, exchanged at `oauth2.googleapis.com/token` for an access token kept until five minutes before it expires) and calls the Search Console API, `POST /webmasters/v3/sites/sc-domain%3A…/searchAnalytics/query`: once per site for the last 100 days by date (one answer serves all ranges; the period ends on the latest day with data, as Search Console lags two to three days), and once per site and range for the top 25 searches. Answers stay an hour in memory, so at most about 16 requests an hour. Days are Google's (Pacific Time). Rows grouped by search leave out rare searches, which the page says. A property not shared with the account (403) is left out with a notice.
- **Sign-in**: Google (shared package [`@babelcoach/google-auth`](../../packages/google-auth)), then the verified email must be in `ADMIN_EMAILS`. The session is a cookie signed with HMAC-SHA256 under `SESSION_SECRET` (email and a 30-day expiry), HttpOnly, Secure in production, SameSite=Lax. There is no database: changing `SESSION_SECRET` signs everyone out, and removing an email from `ADMIN_EMAILS` locks that person out at once.
- **Security**: every POST must carry `Origin` = `CONSOLE_URL` (403 otherwise; Astro's own origin check is off because behind the proxy Astro does not see the public URL). Pages send a CSP with `script-src 'self'`, `X-Frame-Options: DENY` and `Cache-Control: no-store`.

## Sites and colours

[`sites.yaml`](sites.yaml) lists each site's name, abbreviation, production and staging hosts, Umami website id, Search Console property (for a later change) and colour. A test checks that its ids are exactly those of [`../comments/sites.yaml`](../comments/sites.yaml). The file is bundled into the build, so a change needs a redeploy.

Each site has a colour that recalls it, with a light and a dark step: lime for Anglais gratuit (`#a2bc32` / `#c8e100`, the dark step is the lime of the site's buttons), broccoli green for Simply Good Food (`#487c25` / `#478809`), bordeaux for Alt Web (`#92123b` / `#aa4964`, lightened to stay readable on the dark page) and blue for Bon et gratuit (`#2a78d6` / `#3987e5`). Chart lines cross, so `test/colors.test.ts` checks every pair in each theme: OKLab ΔE ≥ 15 in normal vision and ≥ 8 under protan, deutan and tritan simulation, and contrast ≥ 3:1 on the dark surface, ≥ 2:1 on the light one (the light lime sits at 2.09:1; the chart's end labels, totals legend and table view carry the identity). The dark lime is brighter than the palette method's lightness band, by choice: it is the site's own colour. How the steps were searched: `openspec/changes/archive/*-change-site-colours/design.md`. Run the tests after changing a colour. Text never takes a site colour: the coloured dot beside it carries the identity.

## Configuration

| Variable | Meaning |
| --- | --- |
| `CONSOLE_URL` | Public URL, e.g. `https://console.babelcoach.com` (https required in production). Used for the Origin check and the Google redirect URI |
| `COMMENTS_API_URL` | The comments service, e.g. `https://astro-common-comments.babelcoach.com` |
| `CONSOLE_TOKEN` | Same value as `CONSOLE_TOKEN` on the comments service (at least 32 characters, e.g. `openssl rand -base64 36`) |
| `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD` | Umami server (`https://stats.babelcoach.com`) and the console's view-only account. Without them the Visits page says the statistics are unavailable |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The same Google OAuth client as the comments service, with the redirect URI `<CONSOLE_URL>/auth/google/callback` added |
| `ADMIN_EMAILS` | Comma-separated Google accounts allowed in |
| `SESSION_SECRET` | Cookie signing key, at least 32 characters (development: random at each start) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The service account's JSON key (raw, or base64 of it), read-only on the four Search Console properties (below). Without it the Search page says the statistics are unavailable |
| `SEARCH_CONSOLE_API_URL`, `GOOGLE_TOKEN_URL` | Tests only (the browser tests point them at the fake upstream server); refused in production |
| `PORT`, `HOST` | Default 4340; the image sets `HOST=::` |
| `DEV_MODE` | Development only (refused when `NODE_ENV=production`): the sign-in page offers a sign-in without Google, still limited to `ADMIN_EMAILS` |

In production, a configuration without `CONSOLE_URL`/`COMMENTS_API_URL` in https, `CONSOLE_TOKEN`, `SESSION_SECRET`, the Google client or `ADMIN_EMAILS` makes every request answer 500, the health check included, and the log lists the problems. Coolify then keeps the previous deployment online.

### Search Console access

1. In [Google Cloud](https://console.cloud.google.com/), create a project (or reuse one) and enable the **Google Search Console API** (APIs & Services → Library).
2. IAM & Admin → Service accounts → **Create service account** (e.g. `babelcoach-console`), no roles needed. Open it → Keys → **Add key → JSON**: a file downloads; it is the secret.
3. In [Search Console](https://search.google.com/search-console), for each of `sc-domain:anglais-gratuit.org`, `sc-domain:simplygoodfood.eu`, `sc-domain:alt-web.org` and `sc-domain:bon-et-gratuit.fr`: Settings → Users and permissions → **Add user**, the service account's email (`…@….iam.gserviceaccount.com`), permission **Restricted**.
4. Put the key in the variable `GOOGLE_SERVICE_ACCOUNT_JSON`: the file's content on one line, or `base64 -w0 key.json`.

### Umami account

In Umami (Settings → Users), create a user `console` with the role **view-only** and no two-factor sign-in (the console cannot enter codes). Give it access to the four websites, e.g. through a team that holds them, where the user is a **view-only** member. Then check: `POST /api/auth/login` with that user returns a token, and `GET /api/websites/<id>/pageviews?...` answers for each of the four ids.

## Local development

```bash
# terminal 1, at the repository root: the comments service with its admin API on
CONSOLE_TOKEN=dev-console-token pnpm dev
# terminal 2: the console on http://localhost:4340 (dev sign-in)
CONSOLE_TOKEN=dev-console-token ADMIN_EMAILS=you@example.org pnpm dev:console
```

Add `UMAMI_URL`, `UMAMI_USERNAME` and `UMAMI_PASSWORD` to see real visits, and `GOOGLE_SERVICE_ACCOUNT_JSON` for real Search Console figures.

- `pnpm --filter @babelcoach/console test`: unit tests (configuration, sites and colours, session, sign-in, guard, API clients including the Search Console sign-in, visits, search, chart, components)
- `pnpm --filter @babelcoach/console test:e2e`: builds the console and runs Playwright against fake upstreams ([`e2e/fakes.ts`](e2e/fakes.ts)), with three console instances (all fine; comments down and one site failing in Umami and Search Console; Umami and Search Console down) and a throwaway service-account key, also with JavaScript disabled
- `pnpm --filter @babelcoach/console check`: `astro check` (TypeScript 6 in this package: `@astrojs/check` cannot drive the native TypeScript 7 of the workspace root)

## Deploy (Coolify)

Live at https://console.babelcoach.com: Coolify project `astro-common`, environment `production`, application `console`, from `hecmec/astro-common` branch `main`, auto-deploy on push. Domain `console.babelcoach.com` (covered by the `*.babelcoach.com` wildcard).

- Build pack Dockerfile, file `services/console/Dockerfile`, build context the repository root, port 4340.
- Health check `/healthz` on port 4340 (the server listens on IPv6 and IPv4).
- No volume: the console keeps no data.
- Runtime variables: `CONSOLE_URL`, `COMMENTS_API_URL`, `CONSOLE_TOKEN`, `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `ADMIN_EMAILS`, `SESSION_SECRET`, and **`HOST=::`**. Coolify injects `HOST=0.0.0.0` into every application, which overrides the image's `HOST=::`: the server then listens on IPv4 only, `localhost` (`::1` in the image) refuses the health check and Coolify rolls the deployment back.
- Application uuid `scsh0dmgyxiqxcxqipkdwnrl`.
- On the `comments` application: the same `CONSOLE_TOKEN`, and `CONSOLE_URL` so the new-comment email links here.

The image is about 300 MB: Astro and Vite come with the production dependencies the server needs.

## In the four sites

The "Comments ↗" link of each site's admin menu should open the console filtered on that site. It is set in each site's repository, not here:

| Site | Link |
| --- | --- |
| alternative-web | `https://console.babelcoach.com/comments?site=alt-web` |
| simplygoodfood | `https://console.babelcoach.com/comments?site=simplygoodfood` |
| anglais-gratuit | `https://console.babelcoach.com/comments?site=anglais-gratuit` |
| bonetgratuit | `https://console.babelcoach.com/comments?site=bonetgratuit` |

## Runtime dependencies

| Package | Why |
| --- | --- |
| `astro`, `@astrojs/node` | Server rendering and the Node server (approved in the `add-admin-console` change, archived as `openspec/changes/archive/2026-11-16-add-admin-console`) |
| `zod`, `yaml` | Validation of `sites.yaml` (as in the comments service) |
| `@babelcoach/google-auth` | Workspace package, bundled into the build |

Tailwind 4 runs only at build time. The chart is plain SVG and needs no library.
