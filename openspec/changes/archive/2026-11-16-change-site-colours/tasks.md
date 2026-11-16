## 1. Colours and checks

- [x] 1.1 `services/console/test/colors.test.ts`: check every pair of site colours in each theme (normal ΔE ≥ 15, protan/deutan/tritan ≥ 8), contrast ≥ 3:1 dark and ≥ 2:1 light; update the formula reference values; verify the test fails on the current colours (orange/yellow in dark mode)
- [x] 1.2 `services/console/sites.yaml`: the new light and dark steps (AG `#a2bc32`/`#c8e100`, SGF `#487c25`/`#478809`, AW `#92123b`/`#aa4964`, BG `#2a78d6`/`#3987e5`) and the comment on how they were chosen; verify `pnpm --filter @babelcoach/console test` passes
- [x] 1.3 Run the palette validator on both sets (`--pairs all`, light and dark) and verify the results match design.md

## 2. Pages and docs

- [x] 2.1 Screenshot the Visits and Comments pages in light and dark mode against the fake upstreams and verify lines, end labels, legend dots and badges are readable and tell the sites apart
- [x] 2.2 `services/console/README.md`: colour section (names of the colours, every-pair check, the site's lime outside the band); verify by reading against the test
- [x] 2.3 Verify `pnpm --filter @babelcoach/console check` and `pnpm --filter @babelcoach/console test:e2e` pass

## 3. Release

- [x] 3.1 Commit on `develop`, then (when asked) fast-forward `main` and push; verify the Coolify deployment of `console` finishes healthy and https://console.babelcoach.com/visits shows the new colours
- [x] 3.2 After the switch from lemon to lime: release again and verify the live chart shows the lime of Anglais gratuit
