## Context

See proposal.md for the motivation. Constraints that shape the design:

- The four sites are static Astro builds served by nginx in Docker on one Coolify server (OVH, France), each with a staging (`*.babelcoach.com`, from `develop`) and a production domain (from `main`). Their only runtime logic today is nginx basic auth on `/admin`.
- The sites live on different registrable domains (`alt-web.org`, `simplygoodfood…`, …), so anything the service stores in a cookie is third-party on the sites. Safari and Firefox block or partition third-party cookies and storage.
- One person runs everything: the service must be cheap to host, have few moving parts, and be easy to back up.
- The sites are built in Docker from their own GitHub repos; at build time they cannot see a sibling directory on the developer's machine.
- The npm supply-chain attacks of 2025–2026 (chalk/debug hijack, Shai-Hulud 1 and 2, axios) came in as freshly published malicious versions running install scripts. The service handles personal data, so its dependency tree must stay small and guarded.

## Goals / Non-Goals

**Goals:**
- One service and one database for the four sites, with a per-site configuration.
- An explicit list of the domains allowed to embed the service; nothing works anywhere else.
- Sign-in that works in all major browsers without third-party cookies.
- Comments visible to crawlers after N days without making the sites dynamic.
- A site build that never fails because the comments service is down.
- As few runtime dependencies as possible, each one justified.

**Non-Goals:**
- Threaded discussions between readers (only admin replies, one level).
- Rich text, images or attachments in comments.
- Several moderators or roles.
- Real-time updates (a reload shows new comments).
- FranceConnect / La Poste sign-in (possible later change if eligibility is confirmed).
- Migrating any of the four sites; each gets its own small change.

## Decisions

### 1. Script include, not iframe

The site loads `https://comments.babelcoach.com/widget.js` and a mount element; the widget renders into the page's DOM inside a shadow root, reading the page's `lang` and CSS custom properties for colours.

- *Why*: an iframe cannot size itself to its content without postMessage plumbing, does not inherit the site's look, and its cookies are third-party, so sign-in inside it fails on Safari and Firefox.
- *Alternative*: iframe for isolation. Rejected for the reasons above; the shadow root gives enough style isolation.

### 2. Allowed domains in `sites.yaml`

`services/comments/sites.yaml` declares each site: id, name, the list of `domains` (host names, production and staging) allowed to embed it, optional `dev_origins` (e.g. `http://localhost:4325`, honoured only when `ALLOW_DEV_ORIGINS=true`, never in production), languages, reaction kinds and `bake_after_days`. A domain belongs to one site only; startup fails otherwise. Allowed origins are `https://<domain>` for each domain.

The list is enforced at every entry point:
- API: a request whose `Origin` is not an allowed origin of the site in its path is refused (403); state-changing requests must carry an allowed `Origin`. Only the public export accepts requests without `Origin` (site builds).
- Sign-in: a sign-in flow can only be created from an allowed origin, and the popup shows the site's name and refuses to start for any other.
- The widget, receiving 403, renders nothing.

Adding a domain is an edit to `sites.yaml` and a redeploy.

### 3. Popup sign-in, completed by polling, bearer token kept by the site page

1. The widget asks the API to create a sign-in *flow* (`POST /auth/flows`, origin-checked); it gets a random 256-bit flow id.
2. It opens a popup on the service's origin, `/auth/start?flow=<id>`. There the reader picks Google or email. Everything in the popup is first-party to the service, so OAuth and the email flow work normally.
3. When sign-in completes (Google callback, or the email link opened in any browser or device), the service creates a session and parks its token on the flow.
4. The widget polls `GET /auth/flows/<id>` every 1.5 s while the flow is open; the first poll after completion receives the token, which is then removed from the flow. The popup closes itself.
5. The widget stores the token in the site's `localStorage` and sends it as `Authorization: Bearer` on API calls. The API never relies on cookies for readers.

- Polling instead of `postMessage` to `window.opener`: one mechanism covers Google, the email link opened on another device, and pages or browsers where `opener` is lost.
- Token: random opaque id; only its SHA-256 is stored (sessions table); 90-day lifetime; revocable (sign-out, account deletion). Opaque rather than JWT so revocation is a row delete.
- A token is bound to the site it was issued for; signing in on another site is a new sign-in (the Google step is usually instant).
- Flows expire after 20 minutes.
- *Alternative*: a cookie on a shared parent domain. Impossible, the sites have different registrable domains. *Alternative*: Storage Access API. Uneven browser support and extra prompts.
- *Risk*: a token in `localStorage` can be read by script injected into the site. The sites are static, with no third-party scripts besides Umami; the token only allows posting comments in the reader's name. Accepted.

### 4. Google sign-in without an OIDC library

Authorization code flow with PKCE (S256), `state` = the flow id, scope `openid email profile`. The code is exchanged at Google's token endpoint over TLS and the profile read from Google's userinfo endpoint with the access token (`sub`, `email`, `email_verified`, `name`). No ID token is parsed, so no JWT library is needed; the TLS connection to Google authenticates the response (OIDC Core 3.1.3.7). About 60 lines instead of `openid-client` and its two dependencies.

### 5. Email sign-in by magic link

The reader enters an email in the popup; the service mails a single-use link valid 15 minutes (only its hash is stored). Opening it anywhere completes the flow (decision 3) and shows "You are signed in, you can return to the page". In development, without SMTP settings, mails are printed to the log.

### 6. Admin is a configured identity

`ADMIN_EMAIL` (environment) names the admin. Whoever signs in with Google under that verified email gets the admin role. The admin page uses a first-party `HttpOnly`, `Secure`, `SameSite=Lax` cookie on the service's own domain; its forms are POSTs whose `Origin` must be the service's own.

### 7. Stack: Node 26 LTS, Hono, built-in SQLite, TypeScript without a build step

- **Node 26** (Active LTS since 28 October 2026, supported until April 2029) in the Docker image. Node 24 works for local development.
- **Hono** with `@hono/node-server`: a small, typed web framework with no dependencies of its own, built on the standard `Request`/`Response` objects.
- **`node:sqlite`** (built into Node) instead of `better-sqlite3`: no native module to compile, so no install script to allow. WAL mode. Backups with `VACUUM INTO`, run nightly and copied off the server.
- **TypeScript run directly** by Node's type stripping (erasable syntax only, `.ts` import extensions); `tsc --noEmit` checks types. No transpiler in the service.
- **Widget**: plain TypeScript bundled with esbuild into one file, no framework.
- **Other runtime dependencies**: `zod` (validation), `yaml` (`sites.yaml`), `nodemailer` (SMTP). All three have no dependencies of their own.
- *Alternatives*: PostgreSQL (overkill for tens of comments a week, one more container); Remark42 (no pre-moderation queue) or Isso (no OAuth).

Workspace layout:

```
astro-common/
  services/comments/        API, popup and admin pages, sites.yaml, Dockerfile
  packages/comments-widget/ browser widget (built into services/comments/public)
  packages/astro-comments/  Astro component + build-time export fetch (plain JS + JSDoc)
```

`astro-comments` is plain JavaScript checked with JSDoc, because Node does not strip types inside `node_modules`, where the sites will install it.

### 8. Dependency policy

- **pnpm 12** (`packageManager` pinned). `minimumReleaseAge: 10080` (7 days) in `pnpm-workspace.yaml`: no version younger than a week is installed, direct or transitive. The hijacked versions of the 2025–2026 attacks were pulled within 2.5 to 12 hours.
- Dependency install scripts stay blocked (pnpm default); the only allowed build is esbuild's, declared explicitly.
- Exact versions in `package.json`, `pnpm-lock.yaml` committed, `pnpm install --frozen-lockfile` in Docker and CI.
- A new runtime dependency needs a line in the service README saying why.

### 9. Data model

```
users(id, email UNIQUE, google_sub?, display_name?, created_at, blocked_at?)
sessions(token_hash PK, user_id, site_id, created_at, expires_at)   -- site_id '__admin' for the admin
auth_flows(id_hash PK, site_id, origin, lang, code_verifier?, session_token?, created_at, expires_at, completed_at?)
login_links(token_hash PK, flow_id_hash, email, expires_at, used_at?)
comments(id, site_id, path, lang, user_id?, author_name, body, status, created_at,
         moderated_at?, published_at?, sticky)                       -- status: pending|published|refused
replies(comment_id PK, body, created_at, updated_at)
reactions(site_id, path, user_id, kind, created_at)  PK(site_id, path, user_id, kind)
meta(key PK, value)                                                  -- last notification time
```

Deleting a comment deletes its row. "Former reader" keeps a comment with `user_id` null and `author_name` set to the translated "Former reader".

### 10. Page identity

A page is `(site_id, path)`. The widget sends `location.pathname`; the service removes `index.html`, adds a missing trailing slash, collapses repeated slashes and rejects paths over 300 characters or not starting with `/`. Each language version of a page is a different page. Query strings and fragments are never sent.

### 11. Static export

- Endpoint: `GET /api/v1/sites/{site}/export` returns every published comment with `published_at` older than the site's `bake_after_days`, with its reply, grouped by path, plus the reaction counts per page and the cutoff timestamp used. Public, `Cache-Control: public, max-age=600`.
- `astro-comments` fetches it once per build (memoised), and its `<Comments />` component renders, for the current path: the heading and reaction counts, the widget mount with `data-cutoff="<timestamp>"`, then the baked comments with their replies. Comments are listed most recent first, so the widget (comment form, then comments newer than the cutoff) sits above the older, baked ones.
- The widget asks the API only for comments published after the cutoff and shows them above the baked ones; it replaces the static reaction counts with live, clickable ones. Without a cutoff (export failed at build) it fetches everything.
- Baked comments are `<article>` elements with the author's display name and `<time>`; no structured data in v1.
- If the export call fails or times out (5 s), the build logs a warning and renders the section without baked comments. It never fails the build.
- Refresh: each site gets a Coolify scheduled task or an external cron calling its Coolify deploy webhook nightly. Production only.

### 12. At most 300 comments per page, sticky ones kept

A page keeps its 300 most recently published comments plus every sticky one, computed in SQL with `ROW_NUMBER() OVER (ORDER BY published_at DESC)` (per page with `PARTITION BY path` in the export). The page endpoint and the export both filter on that kept set before applying the cutoff, so baked and live comments together never exceed the limit. Comments are listed most recent first; sticky comments are not moved, they keep their place by date. The limit is a constant (`MAX_COMMENTS_PER_PAGE`), not a per-site setting.

- *Alternative*: cut each list separately (export and live). Rejected: a page could then show up to 600.

### 13. Distribution of the Astro component

The sites depend on `astro-comments` as a git dependency on the public astro-common GitHub repo, pinned to a tag: `"@babelcoach/astro-comments": "github:hecmec/astro-common#comments-v1.0.0&path:packages/astro-comments"`. No npm publishing to maintain.

### 14. Abuse limits

Comment body 1–500 characters, plain text; URLs shown as links with `rel="nofollow ugc noopener"`. Per user: 10 comments per hour, 30 pending at once. Per IP: 20 sign-in flows and email requests per hour, kept in memory and never stored. The client IP is read from `X-Forwarded-For` only when `TRUST_PROXY=true` (behind Coolify's proxy).

## Risks / Trade-offs

- [The service is down] → the widget shows a short notice; baked comments still show; builds don't fail.
- [Magic-link emails land in spam] → send from a domain with SPF, DKIM and DMARC set; Google sign-in remains available.
- [Pre-moderation delays] → readers see their own pending comment marked "awaiting moderation", so they don't post it twice.
- [SQLite file lost] → nightly `VACUUM INTO` backup copied off the server; restore steps in the service README.
- [A removed comment stays in baked HTML until the next build] → the nightly rebuild bounds this to a day; the admin can trigger a deploy for urgent removals.
- [Public git dependency exposes the code] → nothing secret lives in the repo; secrets are Coolify runtime variables.
- [A 7-day release delay also delays security fixes] → a fix can be let through explicitly with pnpm's exclusion list after checking it.
- [Admin notifications every 6 hours delay moderation] → readers see their pending comment meanwhile; the admin page always shows the live queue.
- [Polling costs requests] → only while a sign-in popup is open, at most 20 minutes, one small request every 1.5 s.
- [GDPR] → privacy notice on each site; account deletion removes email, sessions and reactions and deletes or anonymises comments (reader's choice).

## Migration Plan

1. Deploy the service on Coolify, create the Google OAuth client, configure SMTP, add the off-server backup.
2. Integrate one site first (alternative-web, staging), then production, then the other three, each in its own repo change.
3. Rollback: remove the component from a site's layout and redeploy; the service can be stopped without affecting the sites beyond the missing section.

## Open Questions

- Exact domain of the service (`comments.babelcoach.com` assumed).
- Default `bake_after_days` per site (7 assumed).
- The reaction kinds and their labels per site (placeholders in `sites.yaml`).
