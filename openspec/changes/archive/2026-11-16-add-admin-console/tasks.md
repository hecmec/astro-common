## 1. Shared Google sign-in

- [x] 1.1 Create `packages/google-auth` (authorization URL with PKCE and state, code exchange, verified email) by moving the code of `services/comments/src/google.ts`, with its own unit tests; verify `pnpm test` and `pnpm check` pass for the package
- [x] 1.2 Make the comments service import `@babelcoach/google-auth` and delete `src/google.ts`; verify the existing comments auth tests and e2e tests pass unchanged

## 2. Comments service: admin API

- [x] 2.1 Config: optional `CONSOLE_TOKEN` and `CONSOLE_URL` (https required in production); verify config tests (missing token: API off; http console URL refused in production)
- [x] 2.2 Bearer-token middleware for `/api/admin/v1` (constant-time compare, 401 on a wrong or missing token, 404 when unset, no CORS headers); verify tests for each case
- [x] 2.3 `GET /summary` and `GET /comments?status&site&path` (ordering by status, full page address, counts per status, 400 on an unknown site); verify API tests against the `comment-admin-api` scenarios
- [x] 2.4 Comment actions (publish, refuse, sticky, unsticky, reply set/remove) and reader block/unblock, answering with the new state, with 404 and 409 cases; verify tests show the same store effects as the `/admin` routes
- [x] 2.5 `GET /rebuilds` and `POST /rebuilds` (status per site, nightly time, "off" without Coolify); verify tests with the fake Coolify of the rebuild tests
- [x] 2.6 Notification email links to `<CONSOLE_URL>/comments` when set, `/admin` otherwise; `/admin` shows a notice linking to the console when `CONSOLE_URL` is set; verify notify and admin tests
- [x] 2.7 README: admin API endpoints, `CONSOLE_TOKEN`, `CONSOLE_URL`; verify by reading against the code

## 3. Console: application frame

- [x] 3.1 Scaffold `services/console` (Astro 7, `@astrojs/node` standalone, Tailwind 4, exact versions, port 4340, `dev`/`build`/`check`/`test`/`test:e2e` scripts) and add it to the root scripts; verify `pnpm install --frozen-lockfile` after the lock update, `pnpm build` and `pnpm check` pass, and the 7-day release age is respected
- [x] 3.2 Config module: `CONSOLE_URL`, `COMMENTS_API_URL`, `CONSOLE_TOKEN`, `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `SESSION_SECRET`, `DEV_MODE` (refused in production); verify unit tests for missing and invalid values
- [x] 3.3 `sites.yaml` (id, name, colour, domain, Umami website id, optional Search Console property) with zod validation and the four sites; verify unit tests, including one that fails when its ids differ from `services/comments/sites.yaml`
- [x] 3.4 Site colours and light/dark theme tokens; verify a unit test of contrast against both backgrounds and of distinguishability under simulated deuteranopia, protanopia and tritanopia
- [x] 3.5 Signed session cookie (HMAC-SHA256, email + 30-day expiry, HttpOnly, Secure in production, SameSite=Lax); verify unit tests (valid, altered, expired, other secret)
- [x] 3.6 Sign-in pages and Google callback using `@babelcoach/google-auth`, allow-list check, return to the requested page, sign-out, dev sign-in when `DEV_MODE`; verify tests with a fake Google token endpoint
- [x] 3.7 Middleware: sign-in required everywhere except sign-in routes and `/healthz`; POSTs refused with 403 unless `Origin` is the console's; verify tests for each case
- [x] 3.8 Layout with the left menu (Comments with pending count, Visits, account, sign-out), folding on narrow screens; verify a test of the count, of no count at zero and of no count when the comments service is down
- [x] 3.9 `/healthz` without sign-in; verify it answers 200 with Umami and the comments service down

## 4. Console: Comments page

- [x] 4.1 Comments API client (bearer token, timeouts, "unavailable" error); verify unit tests against a fake server
- [x] 4.2 Comments page: status tabs with counts, site and page filters in the query string (`?site=` linkable), comment cards with site badge, actions as POST forms with post/redirect/get back to the same tab and filters; verify tests against the `comment-moderation` scenarios
- [x] 4.3 Public reply form, sticky, block/unblock on the cards; verify tests that each POST calls the right API action and redirects back
- [x] 4.4 Rebuild box (status per site, "Rebuild changed sites now", "off" state); verify tests against the `site-rebuild` scenarios
- [x] 4.5 "The comments service is unavailable" state instead of an empty queue; verify a test with the service down

## 5. Console: Visits page

- [x] 5.1 Umami v3 client: login with token reuse, one re-login on 401, `pageviews` per website with `unit=day` and `timezone=Europe/Paris`; record real responses from `stats.babelcoach.com` as fixtures; verify unit tests on the fixtures
- [x] 5.2 Visits data: range (7/30/90, default 30, ending today) and metric (visitors/pageviews) from the query string, the four sites fetched in parallel, missing days filled with zero, per-site failure kept apart, 5-minute memory cache per range and metric; verify unit tests with a fake clock (cache hit within 5 minutes, miss after)
- [x] 5.3 `LineChart` component: inline SVG, axis from zero, gridlines, date labels, one polyline per site in its colour, a `<title>` per point ("Alt Web, 12 Nov: 37 visitors"); verify unit tests on the rendered markup (point count, title text, empty series)
- [x] 5.4 Visits page: range and metric links, chart, totals row as legend, note on how Umami counts visits, notice for a failed site, "Visit statistics are unavailable" when Umami is down; verify tests against the `console-visits` scenarios and that no Umami credential or token appears in the HTML

## 6. Console: browser tests, packaging and docs

- [x] 6.1 Playwright tests with fake comments service and fake Umami: sign in (dev), publish a pending comment, switch the Visits range and metric, all also with JavaScript disabled; verify `pnpm test:e2e` passes
- [x] 6.2 Multi-stage `services/console/Dockerfile` (repo root context, frozen lockfile, Node 26, production dependencies only, health check `/healthz` on 4340, listening on IPv6 and IPv4); verify `docker build` and that the container answers `/healthz`
- [x] 6.3 `services/console/README.md` (configuration, local development with the comments service, deployment, runtime dependencies and why) and the root readme's table; verify by reading against the code

## 7. Deployment

- [x] 7.1 Create the view-only Umami user for the console and add `<CONSOLE_URL>/auth/google/callback` to the Google OAuth client; verify a login with that user returns a token and a sign-in reaches the callback
- [x] 7.2 Release the comments service with `CONSOLE_TOKEN` and `CONSOLE_URL` set; verify `/api/admin/v1/summary` answers with the token and 401 without, and `/admin` shows the notice
- [x] 7.3 Create the Coolify application `console` (project `astro-common`, domain `console.babelcoach.com`, Dockerfile build, port 4340, health check `/healthz`) with its variables, and deploy; verify sign-in, publishing and refusing a test comment, the rebuild box, and the Visits totals against Umami's own dashboard for the same range
- [x] 7.4 Note for the four site repositories: point the admin menu's "Comments" link to `https://console.babelcoach.com/comments?site=<id>` (done in each repository, outside this change); verify the note is in the console README
