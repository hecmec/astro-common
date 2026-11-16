## Context

- The comments service (`services/comments`) is Hono with `node:sqlite`. It is public-facing: the widget of four sites calls it. Its `/admin` page is server-rendered Hono HTML (`src/routes/admin.ts`, about 220 lines) over functions already in `src/store.ts` (`listComments`, `countByStatus`, `setStatus`, `setSticky`, `setReply`, `setBlocked`) and the rebuilder (`src/rebuild.ts`). The admin signs in there with Google (`src/google.ts`, plain `fetch`), and only `ADMIN_EMAIL` is allowed.
- All four production sites send visits to one self-hosted Umami v3 at `https://stats.babelcoach.com` (Coolify project `monitoring`). The website ids are: alt-web `c75ecd49-004b-4d68-a67a-f72d5d5d367d`, simplygoodfood `ff436440-cb62-48ea-a15a-780d6a61e9c3`, anglais-gratuit `e758235d-249c-42fb-829e-8a8c9ffc09a0`, bon-et-gratuit `e1100d32-1ea8-418b-81b7-f38a9612b5f5`. Staging sends nothing.
- The four Search Console properties are domain properties (`sc-domain:…`) in one Google account. They matter only to the later Search change, but they shape the site list below.
- Workspace rules (readme): Node 24+ locally, Node 26 in production, pnpm 12, exact versions, `minimumReleaseAge` of 7 days, install scripts blocked except esbuild, and approval before adding a dependency.

## Goals / Non-Goals

**Goals:**
- The console holds all the secrets of the analytics sources. The comments service gains no secret except the token that lets the console call it.
- The console stays stateless in this change: no database, and restarting it loses nothing.
- Moderation works without client JavaScript, as it does today.
- Adding a menu feature later (Search, deploy status) means adding a page and a source module, without changing the console's frame.

**Non-Goals:**
- Search Console (next change, `add-console-search`).
- Editing site content from the console; each site's own `/admin` keeps that.
- Several roles or per-site permissions: everyone on the allow-list can do everything.
- Real-time updates; a page shows the data as of its last load.
- Removing the comments service's `/admin` (follow-up change).

## Decisions

### A separate Astro SSR application

`services/console` is an Astro 7 app with `@astrojs/node` in standalone mode, built into one Node server. It runs as its own Coolify application.

Alternatives:
- Growing the Hono `/admin` into the console would be the cheapest option. But the Umami credentials and, later, a Google service-account key would end up in the service that every reader reaches.
- Mounting Astro's handler inside the comments process would avoid the admin API. But it mixes a public service and an admin UI in one process and one deploy, and Astro's Node middleware does not plug into Hono's server without glue.

Astro gives components and the authoring style the sites already use. SSR is needed because every page reads live data with server-side secrets.

### Pages render on the server, forms POST, nothing else needs JS

- Each page loads its data in the frontmatter.
- Actions are plain `<form method="post">` to Astro endpoints, which call the comments admin API and redirect back (post/redirect/get), keeping the filters in the query string.
- Same-origin checks: an endpoint refuses a POST whose `Origin` is not the console's own. Together with a `SameSite=Lax` session cookie, this matches the CSRF protection of today's `/admin`.

### Charts are inline SVG rendered on the server

A small chart component (`LineChart.astro`) takes series of `{date, value}` and draws axes, gridlines, one polyline per site and a point per day. Each point has a `<title>` ("Alt Web, 12 Nov: 37 visitors"), so hovering shows the value. The legend is the totals row under the chart, each figure in its site's colour.

The alternative was a chart library (Chart.js, uPlot): a runtime dependency plus client JS for a chart of at most 4 × 90 points. The SVG can be checked in unit tests as plain markup.

### Site colours

Each site has a fixed colour in the site list, used in every chart and as the site badge. The four colours must be distinguishable for the common colour-vision deficiencies and readable in the light and dark themes. A unit test checks contrast against the background, as the sites already test their themes.

### Visits: Umami API, Europe/Paris days, one shared axis

- The console logs in with `POST {UMAMI_URL}/api/auth/login` as a dedicated view-only user and keeps the token in memory. On a 401 it logs in once more, then gives up.
- It reads `GET /api/websites/{id}/pageviews?startAt&endAt&unit=day&timezone=Europe/Paris`. The response has `pageviews` and `sessions` per day; the page labels sessions as "Visitors".
- Ranges are the last 7, 30 or 90 days ending with today (counted so far), default 30, and every range uses daily points.
- Results are cached in memory for 5 minutes per (range, metric).
- The four sites are fetched in parallel. A site whose request fails is drawn as missing, with a notice; the others still show.

The four sites share one linear axis. Sites with much smaller traffic will sit near zero, and the totals row keeps their figures readable. Per-site small charts or an indexed view can come later, if needed.

### The site list is the console's own file

`services/console/sites.yaml` lists, per site id: name, colour, public domain, Umami website id, and (for the next change) the Search Console property. It is validated with zod at startup.

A unit test checks that its ids are exactly those of `services/comments/sites.yaml`, so the two cannot drift. The alternative was a shared site-list package read by both services. It would be cleaner, but it means refactoring the comments service's configuration now; it can be done when a third consumer appears.

### Admin API: thin JSON over the store, bearer token

- `/api/admin/v1` on the comments service (spec `comment-admin-api`): summary counts, the comment list, comment actions, reader block/unblock, rebuild status and run.
- Each handler calls the same `store.ts`/rebuilder functions the `/admin` page uses, so both behave the same during the transition.
- Authentication is `Authorization: Bearer <CONSOLE_TOKEN>`, compared with `crypto.timingSafeEqual`. Without `CONSOLE_TOKEN` the API answers 404, so a forgotten setting fails closed.
- No CORS headers: only the console's server calls the API, never a browser.
- The console calls the comments service at `COMMENTS_API_URL` (its public URL). Coolify's internal network would also work, but the public URL behaves the same in development and production.

### Console sign-in: Google, allow-list, signed cookie

- The Google OAuth code moves from `services/comments/src/google.ts` to `packages/google-auth`: authorization URL with PKCE and state, code exchange, verified email. The comments service then imports it (its behaviour is unchanged and covered by its existing tests).
- The console uses the same OAuth client, with its own redirect URI `<CONSOLE_URL>/auth/google/callback`.
- After sign-in, the console checks the verified email against `ADMIN_EMAILS` (comma-separated). It then sets a cookie that holds the email and an expiry (30 days), signed with HMAC-SHA256 under `SESSION_SECRET`. Attributes: `HttpOnly`, `Secure` in production, `SameSite=Lax`.
- No server-side sessions, hence no database. Signing out clears the cookie. Revoking everyone means changing `SESSION_SECRET`.
- In development, `DEV_MODE=true` offers a sign-in without Google, refused when `NODE_ENV=production`, as in the comments service.

Copying `google.ts` instead would have been quicker, but two copies of OAuth code drift apart, and a drift there becomes a security bug.

### Styling: Tailwind 4

Tailwind 4 matches the four sites. It runs only at build time, so it adds nothing to the runtime image. Plain CSS would have added no dependency at all, but the console will grow pages, and the sites' authoring style is worth keeping. One light/dark token set, as in the sites.

### Packaging

- A multi-stage Dockerfile `services/console/Dockerfile`, with the repository root as build context (like the comments service). It installs with `--frozen-lockfile`, builds the console, then copies `dist/` and the production dependencies to a Node 26 image.
- Port 4340, health check `/healthz` (no sign-in).
- Local development: `pnpm --filter @babelcoach/console dev` on :4340, with the comments service on :4330.

## Risks / Trade-offs

- [Astro and Vite enlarge the dependency tree of a running server] → The console is admin-only and holds no reader data. Versions are exact and pass the 7-day release age, and the runtime image keeps only production dependencies. The comments service's runtime dependencies stay as they are.
- [The `CONSOLE_TOKEN` leaks] → It can moderate but cannot read emails beyond what moderation shows, and cannot reach sessions or exports. It is rotated by changing it on both apps. The API is off without it.
- [Umami changes its API between major versions] → The client targets Umami v3, the version running on `stats.babelcoach.com`. It is one module with its own tests on responses recorded from that server, so an upgrade breaks a test instead of the chart.
- [Sites with small traffic look flat on the shared axis] → The totals row; small per-site charts later if needed.
- [Umami counts a visitor per day, so the sum over 90 days counts returning people more than once] → The totals row says "visits" for sessions, and the help text under the chart says how they are counted.
- [Two moderation UIs during the transition] → Both call the same store functions. `/admin` shows a banner pointing to the console. The follow-up change removes it.
- [The console is reachable on the internet] → Google sign-in plus the allow-list on every route except `/healthz` and the sign-in routes, and the CSRF checks above.

## Migration Plan

1. Release the comments service with `packages/google-auth`, the admin API and `CONSOLE_URL` for the notification link (`/admin` unchanged).
2. Create the view-only Umami user. Add the console's redirect URI to the Google OAuth client.
3. Create the Coolify application `console` (project `astro-common`, domain `console.babelcoach.com`, covered by the `*.babelcoach.com` wildcard) with its variables. Set the same `CONSOLE_TOKEN` on `comments`. Deploy.
4. Check sign-in, a publish and a refuse on a test comment, the rebuild status, and the visits chart against Umami's own dashboard.
5. Point the four sites' "Comments ↗" admin links to the console, in each site's repository.

Rollback: the comments service's `/admin` stays usable throughout. Stopping the console app or unsetting `CONSOLE_TOKEN` returns to the current setup.
