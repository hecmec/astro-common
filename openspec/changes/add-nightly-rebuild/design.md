## Context

The service already computes each site's export (published comments older than `bake_after_days`, replies, reaction counts; see the `comment-static-export` spec). The four sites are Coolify apps on the same server; Coolify queues a deploy with `POST /api/v1/deploy` and `{"uuid": "<app>", "force": false}` (checked on alt-web staging). The service runs as one long-lived Node process with SQLite.

## Goals / Non-Goals

**Goals:** baked comments at most a day behind; no rebuild when nothing changed; one place to configure it, next to the sites.

**Non-Goals:** rebuilding staging apps (they rebuild on push); rebuilding on every moderation action; a general-purpose scheduler.

## Decisions

### The comments service triggers the rebuilds

It knows exactly when a site's export changed, so it can skip unchanged sites. A cron on the server or a scheduled GitHub Action per site would rebuild blindly every night and needs access we don't have (server) or a secret in four repos (Actions).

### Change detection by fingerprint

The fingerprint is a SHA-256 of the export's pages (comment ids, authors, texts, publication dates, replies) and reaction counts, without `cutoff` and `generated_at`. It is stored per site in `meta` (`rebuild:<site>:fingerprint`) only after Coolify accepted the deploy, so a failure is retried next night. The first run rebuilds every configured site once.

### Timing

A check every 10 minutes compares the local time in Europe/Paris (via `Intl.DateTimeFormat`) with `REBUILD_AT` (default `03:30`); the day of the last run is stored in `meta` (`rebuild:last_day`), so restarts don't repeat it. The comments notifier keeps its own timer.

### Configuration

- `sites.yaml`: `rebuild: { coolify_app: <uuid> }` per site, the production app.
- Environment: `COOLIFY_API_URL`, `COOLIFY_DEPLOY_TOKEN` (a token allowed to deploy; ideally a dedicated one), optional `REBUILD_AT`.
- Without URL or token, the feature is off and logged at startup.

### Admin

A "Site rebuilds" box on the admin page: per site, last check time, "rebuild requested", "unchanged" or the error, and a POST button "Rebuild changed sites now" running the same check immediately. Status lives in `meta` (`rebuild:<site>:status`, JSON).

## Risks / Trade-offs

- [A token able to deploy lives in an internet-facing service] → use a dedicated token with the deploy permission only; it is a runtime variable, never in the repo or logs.
- [Reactions change often, so a busy site rebuilds most nights] → at most once a night, a few minutes of build.
- [Coolify deploy endpoint changes] → it already moved from GET to POST once; the call is in one function with its error shown on the admin page.
