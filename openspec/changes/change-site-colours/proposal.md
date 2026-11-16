## Why

The console's site colours were picked from a generic palette (blue, orange, aqua, yellow) and say nothing about the sites. Colours that recall each site are easier to remember: lemon for Anglais gratuit, broccoli green for Simply Good Food, bordeaux red for Alt Web, blue for Bon et gratuit. The current set also lets two colours get confused where lines cross (orange and yellow for colour-blind readers in dark mode), which the new set must avoid.

## What Changes

- New colour per site, one step for the light theme and one for the dark theme:

  | Site | Light | Dark |
  | --- | --- | --- |
  | Anglais gratuit | lemon `#ccb501` | bright lemon `#d8c22c` |
  | Simply Good Food | broccoli green `#6c8a26` | broccoli green `#227702` |
  | Alt Web | bordeaux `#92123b` | bordeaux, lightened for the dark page, `#aa4964` |
  | Bon et gratuit | blue `#2a78d6` (the current blue) | blue `#3987e5` |

- The colour check covers every pair of sites, not only neighbours in the site list: chart lines cross, so any two colours can meet.
- The colours apply everywhere the console shows a site (chart lines and points, totals legend, tooltip, comment badges); nothing else about the pages changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `admin-console`: "The four sites" requirement: the colours must be distinguishable for every pair of sites, and readable on both themes, with the measures stated.

## Impact

- `services/console/sites.yaml` (the colours and their comment), `services/console/test/colors.test.ts` (every pair), `services/console/README.md` (colour section).
- No API, configuration or dependency change. The console is redeployed to show the new colours.
