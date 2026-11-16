# astro-common

Code shared by the BabelCoach sites: [alternative-web](../alternative-web) (Alt Web), [simplygoodfood](../simplygoodfood), [anglais-gratuit](../anglais-gratuit) and [bonetgratuit](../bonetgratuit) (Bon et gratuit).

| Path | What |
| --- | --- |
| [services/comments](services/comments) | Comments service: sign-in (Google, email link), comments per page, reactions, moderation, export for static builds |
| [services/console](services/console) | Admin console of the four sites (https://console.babelcoach.com): comments moderation, visits from Umami |
| [packages/google-auth](packages/google-auth) | Google sign-in (code flow with PKCE), shared by the comments service and the console |
| [packages/comments-widget](packages/comments-widget) | Browser widget, built into `services/comments/public/widget.js` |
| [packages/astro-comments](packages/astro-comments) | Astro component the sites put under their pages: bakes old comments into the HTML, loads the widget |
| [openspec](openspec) | Specs and changes |

## Commands

Node 24+ locally (production runs Node 26 LTS), pnpm 12.

- `pnpm install`
- `pnpm dev`: builds the widget and starts the service on :4330 in development mode (localhost origins, dev sign-in, mails printed in the terminal)
- `pnpm dev:console`: the console on :4340 with a dev sign-in (see [its README](services/console/README.md) for the variables)
- `pnpm test`: unit tests of all packages
- `pnpm test:e2e`: browser tests of the comments service and the console (Playwright, Chromium)
- `pnpm check`: type checks
- `pnpm build`: builds the widget

## Dependency policy

After the npm supply-chain attacks of 2025–2026 (chalk/debug, Shai-Hulud, axios):

- `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`: pnpm installs no version published less than 7 days ago, direct or transitive.
- Dependency install scripts are blocked; esbuild's is the only one allowed (`allowBuilds`).
- Exact versions in `package.json`; `pnpm-lock.yaml` is committed; Docker installs with `--frozen-lockfile`.
- Few runtime dependencies, each listed with its reason in [services/comments/README.md](services/comments/README.md). Ask before adding one.
