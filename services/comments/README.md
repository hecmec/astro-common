# Comments service

Readers of the BabelCoach sites sign in (Google or an email link), comment on a page and react to it. Every comment waits for the admin, who publishes or refuses it and can reply. Published comments older than a few days are exported for the sites' static builds. Design and specs: [openspec/changes/add-comments-service](../../openspec/changes/add-comments-service).

## Allowed domains

[`sites.yaml`](sites.yaml) lists each site and the **domains allowed to embed the service** for it. Pages on any other domain get nothing: the API answers 403, no sign-in can start, the widget hides itself. A domain can belong to one site only (startup fails otherwise). To add a domain or a site, edit `sites.yaml` and redeploy. The same file sets each site's languages, reactions and `bake_after_days`.

## Configuration

| Variable | Meaning |
| --- | --- |
| `BASE_URL` | Public URL, e.g. `https://comments.babelcoach.com` (https required in production) |
| `ADMIN_EMAIL` | The admin's Google account; nobody else can open `/admin` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (Web application). Redirect URI: `<BASE_URL>/auth/google/callback` |
| `SMTP_URL` | nodemailer URL, e.g. `smtps://user:pass@smtp.example.org:465` (without it: in production the email sign-in is off and admin notifications go to the log; in development mails are printed) |
| `MAIL_FROM` | Sender, e.g. `Comments <comments@babelcoach.com>` |
| `DATABASE_PATH` | SQLite file (Docker: `/data/comments.db`, on a persistent volume) |
| `TRUST_PROXY` | `true` behind Coolify's proxy, so rate limits see the real client IP |
| `COOLIFY_API_URL`, `COOLIFY_DEPLOY_TOKEN` | Nightly rebuild of the sites (below): Coolify's URL (`https://coolify.babelcoach.com`) and a token allowed to deploy the sites' production apps. Without them the rebuild is off |
| `REBUILD_AT` | Local time of the nightly rebuild check, Europe/Paris, `HH:MM` (default `03:30`) |
| `CONSOLE_TOKEN` | Shared secret of the [admin console](../console) (at least 32 characters, e.g. `openssl rand -base64 36`). Without it the admin API is off (404). Same value on the console |
| `CONSOLE_URL` | The console's public URL, e.g. `https://console.babelcoach.com`: the new-comment email links to its Comments page and `/admin` shows a notice pointing there. Without it the email links to `/admin` |
| `PORT` | Default 4330 |
| `ALLOW_DEV_ORIGINS`, `DEV_MODE` | Development only (refused when `NODE_ENV=production`): accept `dev_origins` from `sites.yaml`; offer a sign-in without any check |

## Nightly rebuild of the sites

Comments enter a site's HTML only when the site is built. Every night at `REBUILD_AT` (Europe/Paris), the service computes each site's export and compares its fingerprint (comments, authors, texts, replies, reaction counts; not the dates) with the one of the last rebuild it requested. When it differs, it asks Coolify to deploy the site's production app (`rebuild.coolify_app` in `sites.yaml`, `POST /api/v1/deploy`). Unchanged sites are not rebuilt; a failed request is retried the next night. The admin page shows each site's last check and has a "Rebuild changed sites now" button, for example after unpublishing an old comment.

The service runs on the same server as Coolify, so its deploy requests reach Coolify's API from Docker's internal networks, not from the server's public address. Coolify's **Settings → Advanced → Allowed IPs** must therefore include `10.0.0.0/8,172.16.0.0/12` (besides your own address); otherwise Coolify answers 403 "You are not allowed to access the API." before even checking the token, and the rebuild box shows that error for every site.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:4330, admin at /admin (dev sign-in with ADMIN_EMAIL)
ADMIN_EMAIL=you@example.org pnpm dev
```

A site's dev server (e.g. alt-web on :4325) can then embed the widget with `data-api="http://localhost:4330"`.

## Endpoints

| | |
| --- | --- |
| `GET /widget.js` | The widget |
| `POST /auth/flows`, `GET /auth/flows/:id` | Widget starts a sign-in, then polls for the session token (handed over once) |
| `GET /auth/start` | Sign-in popup (Google, email link) |
| `GET /api/v1/sites/:site/page?path=&lang=&after=` | Comments and reactions of a page |
| `POST /api/v1/sites/:site/comments`, `DELETE …/comments/:id` | Post, delete own |
| `PUT /api/v1/sites/:site/reactions` | Toggle a reaction |
| `GET/PUT/DELETE /api/v1/sites/:site/me`, `POST …/logout` | Display name, account deletion, sign-out |
| `GET /api/v1/sites/:site/export` | Published comments older than `bake_after_days`, for site builds |
| `/api/admin/v1/...` | Admin API for the console (below) |
| `/admin` | Moderation (fallback while the console settles in) |
| `GET /healthz` | Health check |

## Admin API

Called only by the console's server, with `Authorization: Bearer <CONSOLE_TOKEN>` (401 otherwise, 404 everywhere when the token is not set). No CORS headers: browsers cannot call it from a page. Each action has the same effect as on `/admin`. JSON in and out.

| | |
| --- | --- |
| `GET /api/admin/v1/summary` | `{ sites: { <id>: { name, pending, published, refused } }, all: { pending, published, refused } }` |
| `GET /api/admin/v1/comments?status=&site=&path=` | `{ comments: [...], counts }`; status `pending` (default, oldest first), `published` or `refused` (newest first); 400 on an unknown site, status or invalid path. Each comment: `id, site, path, url, lang, status, created_at, published_at, author, email, user_id, blocked, sticky, body, reply` |
| `POST /api/admin/v1/comments/:id/{publish,refuse,sticky,unsticky}` | `{ comment }`; 404 unknown comment; 409 for `sticky` on a comment that is not published |
| `PUT /api/admin/v1/comments/:id/reply` | Body `{ "body": "..." }`, empty or `null` removes the reply; `{ comment }`; 409 for a reply to a comment that is not published |
| `POST /api/admin/v1/users/:id/{block,unblock}` | `{ user: { id, blocked } }`; blocking refuses the reader's pending comments |
| `GET /api/admin/v1/rebuilds`, `POST …/rebuilds` | `{ enabled: false }` or `{ enabled: true, at, timezone, sites: [{ id, name, status }] }`; POST runs the check for all sites first |

## Deploy (Coolify)

Live at https://astro-common-comments.babelcoach.com: Coolify project `astro-common` (uuid `ed4xjd7fl1luhtmjfjmeqobm`), environment `production`, application `comments` (uuid `opd326ygqkelvk9qywly16rl`), from `hecmec/astro-common` branch `main` through the GitHub App `hecmec-coolify`, auto-deploy on push. The domain is covered by the `*.babelcoach.com` wildcard. To release, merge `develop` into `main` and push.

**Coolify API**: the token of this project goes in the git-ignored `.env` at the repository root as `COOLIFY_ASTRO_COMMON_API_URL=https://coolify.babelcoach.com` and `COOLIFY_ASTRO_COMMON_API_TOKEN=<id>|<secret>` (with `read:sensitive`, to read logs). The token contains a `|`, so read it with a script rather than `source`. With `Authorization: Bearer <token>`: `GET /api/v1/applications/<uuid>` (status), `GET /api/v1/applications/<uuid>/logs?lines=100`, `GET /api/v1/deployments/applications/<uuid>` (deployments), `POST /api/v1/deploy` with `{"uuid": "<uuid>"}`, `POST /api/v1/applications/<uuid>/restart` after changing variables.

Settings:

- Build pack Dockerfile, file `services/comments/Dockerfile`, build context the repository root, port 4330.
- Health check `/healthz` on port 4330 (the service listens on IPv6 and IPv4: in the image `localhost` is `::1`).
- Persistent volume on `/data`.
- Runtime variables: `BASE_URL`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_URL`, `MAIL_FROM`, `TRUST_PROXY=true`, `CONSOLE_TOKEN`, `CONSOLE_URL`.
- The mail sender's domain needs SPF, DKIM and DMARC, or sign-in links land in spam.

## Backups and restore

`node src/backup.ts` (in the container: `docker exec <container> node src/backup.ts`) writes a consistent copy with `VACUUM INTO` to `/data/backups/comments-<date>.db` and keeps the last 14. Run it nightly (Coolify scheduled task) and copy `/data/backups` off the server.

To restore: stop the service, replace `/data/comments.db` with the backup and delete `comments.db-wal` and `comments.db-shm`, then start it.

## Runtime dependencies

| Package | Why |
| --- | --- |
| `hono`, `@hono/node-server` | HTTP routing on Node; no dependencies of their own |
| `zod` | Validation of `sites.yaml` |
| `yaml` | Reading `sites.yaml` |
| `nodemailer` | Sending sign-in links and admin notifications over SMTP |

SQLite is Node's built-in `node:sqlite`. Google sign-in is the workspace package [`@babelcoach/google-auth`](../../packages/google-auth), shared with the console: plain `fetch`, no OIDC library.
