## Context

The site colours live in `services/console/sites.yaml` (one light and one dark step per site) and become CSS variables (`--site-<id>`) in the console layout; every chart line, point, legend dot and badge uses them. `test/colors.test.ts` checks them with the formulas of the dataviz palette validator (OKLab ΔE×100 under Machado colour-vision simulation, WCAG contrast against the surfaces `#fcfcfb` and `#1a1a19`), today for neighbouring entries of the site list only.

The requested hues pull against readability: Anglais gratuit's lime (`#c8e100`, the colour of its buttons) is light, so it fades on the light page; a bordeaux is dark, so it fades on the dark page; green next to red is the classic red-green confusion, and lime next to broccoli green puts two greens side by side.

## Goals / Non-Goals

**Goals:** the requested hues, as close as the checks allow; every pair distinguishable in both themes; no change to layout, labels or behaviour.

**Non-Goals:** other colours of the console (text, buttons, surfaces); a colour picker or per-user colours.

## Decisions

### The steps were searched, not picked by eye

A search over OKLCH (lime hues 112–124°, greens 135–155°, bordeaux 5–20°, blue fixed; in dark mode the lime fixed to the site's own `#c8e100`) kept only sets where, in each theme, every pair passes ΔE ≥ 15 in normal vision and ≥ 8 under protan, deutan and tritan simulation, and every colour reaches the contrast floor (3:1 on the dark page; 2:1 on the light page, the floor the validator accepts with visible labels). Among those, the set keeps the light lime as close to `#c8e100` as the contrast floor allows, and changes bordeaux and blue as little as possible (they keep the steps of the first version of this change).

| Site | Light | Dark |
| --- | --- | --- |
| Anglais gratuit | `#a2bc32` | `#c8e100` |
| Simply Good Food | `#487c25` | `#478809` |
| Alt Web | `#92123b` | `#aa4964` |
| Bon et gratuit | `#2a78d6` | `#3987e5` |

Validator results, all pairs: light, worst colour-vision ΔE 10.3 (deutan, bordeaux/green), tritan 8.6, normal 22.5 (green/lime), lime at 2.09:1 contrast (relief: end labels, totals legend, table view); dark, worst colour-vision ΔE 8.6 (deutan, bordeaux/green), tritan 9.5, normal 25.3, all four at 3:1 or more.

The first version of this change used a lemon yellow for Anglais gratuit (`#ccb501` / `#d8c22c`); the user meant the lime of the site's buttons, so the lime and a deeper broccoli green replaced it.

### The site's own lime in dark mode, outside the lightness band

The validator also keeps categorical colours inside a lightness band (dark: L 0.48–0.67) so no line outweighs the others. `#c8e100` sits at L 0.86, above it, and passes every readability and colour-vision check: Anglais gratuit's line stands out a little more in dark mode, and it is exactly the site's colour. The test checks what the spec requires (pairs and contrast), not the band.

### Light lime at the 2:1 floor

`#c8e100` reaches about 1.4:1 on the light page. `#a2bc32` is the closest lime at 2.09:1; the chart already names each line at its end and in the totals, and has a table view, which is the relief the 2:1 floor asks for.

### Every pair, not neighbours

Lines cross, so any two colours can touch. The test checks all six pairs in each theme instead of neighbours in the file; the file order no longer matters for the check (it stays the legend order).

### Alternatives considered

- A truer bordeaux in dark mode (`#7b1e3a`): about 1.7:1 on the dark page, unreadable.
- A lighter, yellower broccoli green: too close to the lime; the green moved to a deeper tone (`#487c25` / `#478809`).

## Risks / Trade-offs

- [Bordeaux and green are the closest pair for deuteranopes in dark mode (ΔE 8.6, just above the target)] → End labels and the totals legend name every line; the table view gives the numbers.
- [Lime at 2.09:1 on the light page] → Thin margin above the floor: any future change to the light surface must keep the test passing.
- [Anglais gratuit's line is the brightest in dark mode] → Accepted: it is the site's own lime.

## Migration Plan

Update `sites.yaml` and the test, check the pages in both themes, release to `main` (the console redeploys automatically). Rollback: revert the commit.
