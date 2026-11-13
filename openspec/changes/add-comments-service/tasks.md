## 1. Workspace setup

- [x] 1.1 Create the pnpm workspace (root `package.json` with `packageManager` pnpm 12, `pnpm-workspace.yaml` with `minimumReleaseAge: 10080` and esbuild as the only allowed build, `tsconfig.base.json` for type stripping, `.gitignore`, `.nvmrc` 26, `readme.md`) with `services/comments`, `packages/comments-widget`, `packages/astro-comments`; verify `pnpm install --frozen-lockfile` succeeds and installs no version younger than 7 days
- [x] 1.2 Add Vitest and root `pnpm test` / `pnpm check` running all packages; verify both pass
- [ ] 1.3 Create the GitHub repo `hecmec/astro-common` (public) and push; verify it is reachable without authentication

## 2. Service foundation

- [x] 2.1 Hono server on Node with `/healthz` and env config (`BASE_URL`, `ADMIN_EMAIL`, Google client id/secret, `SMTP_URL`, `MAIL_FROM`, `DATABASE_PATH`, `ALLOW_DEV_ORIGINS`, `TRUST_PROXY`); verify a test that `/healthz` answers 200
- [x] 2.2 `sites.yaml` (id, name, domains, dev_origins, languages, reaction kinds with en/fr/de labels, `bake_after_days`) validated at startup, refusing a domain listed twice; verify tests for a valid file, a duplicate domain and dev origins ignored outside development
- [x] 2.3 `node:sqlite` database with migrations for the tables in design.md (WAL mode); verify migrations run on an empty database in a test
- [x] 2.4 Origin check and CORS per site (allowed domains, mutations need an allowed `Origin`, export open); verify tests for an allowed origin, an unlisted domain and another site's domain
- [x] 2.5 Path normalisation; verify unit tests covering the page-identity scenarios

## 3. Sign-in

- [x] 3.1 Sign-in flows: create (origin-checked, rate-limited per IP), popup start page, polling endpoint that hands the token over once; verify tests that an unlisted origin cannot create a flow and that the token is delivered exactly once
- [x] 3.2 Google sign-in (code + PKCE, userinfo, verified emails only) behind a provider interface; verify tests with a fake provider for verified and unverified emails
- [x] 3.3 Email magic links (15 min, single use, hashed), console mailer in development; verify tests for valid, expired and reused links
- [x] 3.4 Sessions (opaque token, hashed, bound to site, 90 days), bearer auth and sign-out; verify tests that a token from another site is rejected and that sign-out invalidates it
- [x] 3.5 Display name (2–40 chars) required before commenting; verify a test
- [x] 3.6 Account deletion with delete or keep-as-"Former reader"; verify tests for both choices

## 4. Comments and reactions API

- [x] 4.1 Post a comment (pending, 1–500 chars, 10/hour, 30 pending, blocked readers refused); verify tests for each scenario
- [x] 4.2 Page endpoint: published comments with replies, the reader's own pending/refused, optional `after` cutoff, reactions with counts and the reader's own; verify tests that refused comments reach only their author and that no email appears
- [x] 4.3 Delete own comment; verify a test
- [x] 4.4 Reactions toggle, kinds checked against `sites.yaml`; verify tests for add, remove, unknown kind and not signed in
- [x] 4.5 Export endpoint with the cutoff from `bake_after_days`, 10-minute cache; verify tests for younger, older, refused and deleted comments

## 5. Moderation

- [x] 5.1 Admin session: Google sign-in on the service domain, `HttpOnly` cookie, admin only for `ADMIN_EMAIL`, POSTs checked against the service's origin; verify tests that another account is refused
- [x] 5.2 Admin page: pending queue with site filter, publish, refuse; verify a test that a published comment appears in the public page endpoint
- [x] 5.3 History with filters by site, status and page; unpublish and republish; verify a test
- [x] 5.4 Admin reply add/edit/remove; verify a test that the reply appears in the page endpoint and the export
- [x] 5.5 Block a reader (refuses their pending comments, blocks posts and reactions); verify a test
- [x] 5.6 Notification email at most every 6 hours summarising new comments; verify a test with a fake clock and a captured mailbox

## 6. Widget

- [x] 6.1 Build the widget with esbuild into `services/comments/public/widget.js`, served by the service; verify the bundle builds and stays under 20 KB gzipped
- [x] 6.2 Section in a shadow root: heading (unless inside the Astro section), reactions, comments (plain text, line breaks, `nofollow ugc` links), own pending/refused with status, sign-in buttons or form; colours from CSS custom properties; verify with a browser test on a fixture page
- [x] 6.3 en/fr/de strings chosen from the page's `lang`; verify a unit test that the three languages have the same keys
- [x] 6.4 Popup sign-in with polling, token in `localStorage`, display-name prompt, sign-out, account deletion; verify a browser test of the email-link flow with the console mailer
- [x] 6.5 `data-cutoff`: load only newer comments, fall back to all; replace static reaction counts; verify a browser test
- [x] 6.6 Outage: short unavailable notice, 5 s timeout; verify a browser test with an unreachable service URL

## 7. Astro component

- [x] 7.1 `@babelcoach/astro-comments` export fetch, memoised per build, 5 s timeout, warning on failure; verify unit tests for success, timeout and invalid response
- [x] 7.2 `<Comments />` component and its HTML renderer (`<article>`, display name, `<time>`, reply, reaction counts, widget mount with `data-cutoff`), labels in en/fr/de; verify unit tests on the renderer output, escaping included
- [x] 7.3 Installation guide in the package README (git dependency pinned to a tag, service URL build variable, layout placement, CSP); verify by reading it against the component's props

## 8. Deployment

- [x] 8.1 Dockerfile for the service (Node 26 alpine, pnpm frozen lockfile, widget built, prod dependencies only, non-root, database on `/data`) and a backup script using `VACUUM INTO`; verify `docker build` and `docker run` serve `/healthz` and `/widget.js`
- [ ] 8.2 Coolify application, domain `comments.babelcoach.com`, runtime variables, persistent volume; verify `/healthz` over HTTPS
- [ ] 8.3 Google OAuth client with the production and local redirect URIs; SMTP sender with SPF/DKIM/DMARC; verify a real Google sign-in and a magic link received in a Gmail inbox, not spam
- [ ] 8.4 Nightly backup copied off the server, restore steps in the service README; verify by restoring a backup into a local instance
- [ ] 8.5 End-to-end check on alternative-web staging (in a separate alternative-web change): post, moderate, see it live, then see it baked after a build with `bake_after_days` temporarily at 0

## 9. Sticky comments, page limit, shorter comments

- [x] 9.1 Migration adding `comments.sticky`; verify the migration test sees version 2 and the column
- [x] 9.2 Page endpoint and export keep the 300 most recent published comments per page plus sticky ones, in publication order, the limit spanning baked and live comments; verify tests with 310 and 305 comments, sticky inside and outside the last 300, and a cutoff
- [x] 9.3 Admin "Make sticky" / "Remove sticky" on published comments with a sticky badge; verify a test through the admin routes
- [x] 9.4 Comment length 1–500 characters in the API and the widget; verify the length test
- [x] 9.5 Admin notification at most every 6 hours; verify the notification test
- [x] 9.6 Comments listed most recent first (page endpoint, export, widget, baked section), the widget with the form above the baked comments; verify the order tests and the browser test that a live comment shows above a baked one
- [x] 9.7 German strings with the formal "Sie" in the widget, the popup, the emails and the baked heading, matching the German sites; verify the browser tests in German
- [x] 9.8 Notices by kind: a confirmation after posting (accent bar and check mark), errors in the danger colour, neither looking like a field; verify the browser test for the success notice and screenshots
- [x] 9.9 Reaction counts shown from 1 only; verify the browser test on the button text before and after reacting
- [ ] 9.10 Tag `comments-v1.1.0` (astro-comments 1.1.0: formal German heading) and update the sites to it
