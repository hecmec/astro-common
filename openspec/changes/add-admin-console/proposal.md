## Why

The four BabelCoach sites are run from scattered places: comments are moderated on the comments service's own `/admin` page, visits are read site by site in Umami, and each site has its own static admin for content. There is no single place to see how the four sites are doing together, and no room to add operations features without adding more to the public-facing comments service.

## What Changes

- New `services/console`: an Astro SSR application (Node adapter) at `console.babelcoach.com`, the admin console of the four sites. A left menu lists its features. The first two are Comments and Visits; Search (Google Search Console) will be added by a later change.
- **Comments page**: moderation of all four sites from the console (queue, publish, refuse, unpublish, sticky, public reply, block a reader, filters by site, status and page), with the number of pending comments in the menu, and the site rebuild status and button now on the comments service's admin page.
- **Visits page**: one chart with the four sites' daily visitors (or pageviews) over 7, 30 or 90 days, read from the self-hosted Umami at `stats.babelcoach.com`, with each site's total for the period.
- **Console sign-in**: Google, limited to an allow-list of admin emails; the session is a signed cookie, so the console keeps no database.
- **Comments service: admin API** `/api/admin/v1`, called only by the console's server with a shared secret (`CONSOLE_TOKEN`). It exposes the moderation and rebuild actions the `/admin` page uses today.
- The new-comment notification email links to the console instead of `/admin`.
- The Google sign-in code of the comments service moves to a shared package used by both applications.
- The comments service's `/admin` page stays as a fallback during this change; a follow-up change removes it once the console has run for a while.

## Capabilities

### New Capabilities

- `admin-console`: the console application, its sign-in and allow-list, its menu and its list of sites (names, colours, Umami ids).
- `console-visits`: the Visits page, Umami as its source, the ranges, metrics, chart and totals.
- `comment-admin-api`: the comments service's admin API: its authentication and its moderation and rebuild operations.

### Modified Capabilities

- `comment-moderation`: moderation moves from the comments service's admin page to the console's Comments page; the notification email links to the console.
- `site-rebuild`: the rebuild status and the "Rebuild changed sites now" button move to the console.

## Impact

- `services/console` (new): Astro, `@astrojs/node`, a Dockerfile, a README, unit and browser tests.
- `services/comments`: the admin API routes, a `CONSOLE_TOKEN` and `CONSOLE_URL` configuration, the notification link, the README.
- `packages/google-auth` (new): the Google OAuth code moved from `services/comments/src/google.ts`.
- Dependencies: `astro` and `@astrojs/node` are added to the workspace (the dependency policy requires this approval; approved in exploration). The comments service's runtime dependencies do not change.
- Coolify: a new `console` application in the project `astro-common`, with the variables `CONSOLE_TOKEN`, `COMMENTS_API_URL`, `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `SESSION_SECRET`; `CONSOLE_TOKEN` and `CONSOLE_URL` on the `comments` application.
- Google Cloud: the console's redirect URI added to the existing OAuth client.
- Umami: a view-only user for the console.
- Outside this repository: the "Comments ↗" link in the admin menus of alternative-web, simplygoodfood, anglais-gratuit and bonetgratuit should point to the console (`/comments?site=<id>`). That is a one-line edit in each site's repository, done there.
