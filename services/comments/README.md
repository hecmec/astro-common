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
| `SMTP_URL` | nodemailer URL, e.g. `smtps://user:pass@smtp.example.org:465` (required in production; without it mails are printed) |
| `MAIL_FROM` | Sender, e.g. `Comments <comments@babelcoach.com>` |
| `DATABASE_PATH` | SQLite file (Docker: `/data/comments.db`, on a persistent volume) |
| `TRUST_PROXY` | `true` behind Coolify's proxy, so rate limits see the real client IP |
| `PORT` | Default 4330 |
| `ALLOW_DEV_ORIGINS`, `DEV_MODE` | Development only (refused when `NODE_ENV=production`): accept `dev_origins` from `sites.yaml`; offer a sign-in without any check |

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
| `/admin` | Moderation |
| `GET /healthz` | Health check |

## Deploy (Coolify)

- Build pack Dockerfile, file `services/comments/Dockerfile`, build context the repository root, port 4330.
- Persistent volume on `/data`.
- Runtime variables: `BASE_URL`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_URL`, `MAIL_FROM`, `TRUST_PROXY=true`.
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

SQLite is Node's built-in `node:sqlite`; Google sign-in uses `fetch` (no OIDC library).
