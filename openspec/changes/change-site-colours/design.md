## Context

The site colours live in `services/console/sites.yaml` (one light and one dark step per site) and become CSS variables (`--site-<id>`) in the console layout; every chart line, point, legend dot and badge uses them. `test/colors.test.ts` checks them with the formulas of the dataviz palette validator (OKLab ΔE×100 under Machado colour-vision simulation, WCAG contrast against the surfaces `#fcfcfb` and `#1a1a19`), today for neighbouring entries of the site list only.

The requested hues pull against readability: a lemon yellow is light, so it fades on the light page; a bordeaux is dark, so it fades on the dark page; green next to red is the classic red-green confusion.

## Goals / Non-Goals

**Goals:** the requested hues, as close as the checks allow; every pair distinguishable in both themes; no change to layout, labels or behaviour.

**Non-Goals:** other colours of the console (text, buttons, surfaces); a colour picker or per-user colours.

## Decisions

### The steps were searched, not picked by eye

A search over OKLCH (lemon hues 95–110°, greens 125–145°, bordeaux 5–20°, blue fixed) kept only sets where, in each theme, every pair passes ΔE ≥ 15 in normal vision and ≥ 8 under protan, deutan and tritan simulation, and every colour reaches the contrast floor (3:1 on the dark page; 2:1 on the light page, the floor the validator accepts with visible labels). Among those, the set keeps lemon as light and bordeaux as dark as the floors allow.

| Site | Light | Dark |
| --- | --- | --- |
| Anglais gratuit | `#ccb501` | `#d8c22c` |
| Simply Good Food | `#6c8a26` | `#227702` |
| Alt Web | `#92123b` | `#aa4964` |
| Bon et gratuit | `#2a78d6` | `#3987e5` |

Validator results, all pairs: light, worst colour-vision ΔE 15.9 (protan, lemon/green), tritan 8.7, normal 19.2, lemon at 2.01:1 contrast (relief: end labels, totals legend, table view); dark, worst colour-vision ΔE 8.5 (deutan, bordeaux/green), tritan 14.6, normal 25.3, all four at 3:1 or more.

### Bright lemon in dark mode, outside the lightness band

The validator also keeps categorical colours inside a lightness band (dark: L 0.48–0.67) so no line outweighs the others. Inside the band, the dark lemon is a mustard `#ab9017`. The user chose the brighter `#d8c22c` (L 0.81), which passes every readability and colour-vision check: Anglais gratuit's line stands out a little more in dark mode, and it reads as lemon. The test checks what the spec requires (pairs and contrast), not the band.

### Light lemon at the 2:1 floor

A lemon dark enough for 3:1 on the light page is olive. `#ccb501` stays yellow at 2.01:1; the chart already names each line at its end and in the totals, and has a table view, which is the relief the 2:1 floor asks for.

### Every pair, not neighbours

Lines cross, so any two colours can touch. The test checks all six pairs in each theme instead of neighbours in the file; the file order no longer matters for the check (it stays the legend order).

### Alternatives considered

- A truer bordeaux in dark mode (`#7b1e3a`): about 1.7:1 on the dark page, unreadable.
- A darker green to separate it from bordeaux: the lighter broccoli tones separate better from the lemon in light mode, which was the tighter pair.

## Risks / Trade-offs

- [Bordeaux and green are the closest pair for deuteranopes in dark mode (ΔE 8.5, at the target)] → End labels and the totals legend name every line; the table view gives the numbers.
- [Lemon at 2.01:1 on the light page] → Thin margin above the floor: any future change to the light surface must keep the test passing.
- [Anglais gratuit's line is the brightest in dark mode] → Accepted by the user for a recognisable lemon.

## Migration Plan

Update `sites.yaml` and the test, check the pages in both themes, release to `main` (the console redeploys automatically). Rollback: revert the commit.
