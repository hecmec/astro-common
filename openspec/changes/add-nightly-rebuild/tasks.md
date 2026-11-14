## 1. Configuration

- [x] 1.1 `sites.yaml`: optional `rebuild.coolify_app` per site, validated; the four production apps; dev origins set to the sites' real local ports; verify the sites tests
- [x] 1.2 Config: `COOLIFY_API_URL`, `COOLIFY_DEPLOY_TOKEN`, `REBUILD_AT` (HH:MM, default 03:30); verify the config tests

## 2. Rebuild

- [x] 2.1 Export fingerprint ignoring the cutoff and generation dates; verify unit tests (cutoff only moved: same; comment crossing the delay, removal, reply, reaction: different)
- [x] 2.2 Rebuilder: for each configured site, compare fingerprints, POST the Coolify deploy, store fingerprint on success and a status per site; verify tests with a fake Coolify (requested, unchanged, failure retried)
- [x] 2.3 Nightly timing in Europe/Paris with the last day in `meta`; verify tests with a fake clock (before 03:30: nothing; after: once; restart the same day: nothing)
- [x] 2.4 Wire into the server (10-minute check) and log at startup whether it is on; verify by running the service

## 3. Admin and docs

- [x] 3.1 "Site rebuilds" box with per-site status and the "Rebuild changed sites now" button; verify an admin test
- [x] 3.2 README: configuration, token, behaviour; verify by reading against the code

## 4. Deployment

- [ ] 4.1 Set `COOLIFY_API_URL` and `COOLIFY_DEPLOY_TOKEN` on the comments app and redeploy; verify the startup log says the nightly rebuild is on and the admin box shows the sites
