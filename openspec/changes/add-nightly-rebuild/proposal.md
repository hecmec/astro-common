## Why

Published comments enter a site's static HTML only when the site is built (see the `comment-static-export` spec). Without a regular rebuild, comments that reach the delay never get baked for crawlers, and removed ones stay in the HTML. The four sites' production apps rebuild only when `main` is pushed.

## What Changes

- The comments service triggers a rebuild of each site's production app on Coolify once a night (default 03:30, Europe/Paris), and only for sites whose export changed since the last rebuild it triggered: no rebuild when nothing changed.
- Each site in `sites.yaml` names its production Coolify application (`rebuild.coolify_app`); a site without it is never rebuilt.
- New runtime variables `COOLIFY_API_URL` and `COOLIFY_DEPLOY_TOKEN`; without them the nightly rebuild is off and the service says so at startup.
- The admin page shows, per site, the last rebuild check and its result, and a "Rebuild changed sites now" button for urgent removals.
- `sites.yaml`: the production apps of the four sites, and the dev origins corrected to the sites' real local ports.

## Capabilities

### New Capabilities

- `site-rebuild`: the nightly, change-driven rebuild of the sites' production apps, its configuration and its admin controls.

### Modified Capabilities

(none)

## Impact

- `services/comments`: a rebuild scheduler, the Coolify deploy call, `sites.yaml`, the admin page, the README.
- Coolify: the two variables on the `comments` app; a token allowed to deploy the four production apps.
- Each production site may be rebuilt once a night (a few minutes of build each).
