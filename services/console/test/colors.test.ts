import { describe, expect, it } from 'vitest';
import { SURFACES, contrast, deltaE } from '../src/lib/colors.ts';
import { sites } from './helpers.ts';

/**
 * The site colours (spec admin-console, "The four sites"): distinguishable for common
 * colour-vision deficiencies and readable on both themes. Thresholds of the dataviz
 * palette method: OKLab ΔE×100 >= 8 under protan/deutan simulation and >= 15 in normal
 * vision for neighbouring entries, tritan reported; contrast >= 3:1 on the surface, or
 * >= 2:1 with relief (the chart's direct end labels, legend and table view).
 */
const modes = ['light', 'dark'] as const;
const pairs = sites.slice(1).map((s, i) => [sites[i]!, s] as const);

describe('site colours', () => {
  it('reproduce the reference values of the formulas', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(deltaE('#2a78d6', '#2a78d6')).toBe(0);
    // validator report: #eda100 vs #1baf7a, worst adjacent protan ΔE 9.1
    expect(deltaE('#eda100', '#1baf7a', 'protan')).toBeCloseTo(9.1, 1);
  });

  for (const mode of modes) {
    it(`are distinguishable under simulated colour-vision deficiencies (${mode})`, () => {
      for (const [a, b] of pairs) {
        const [x, y] = [a.color[mode], b.color[mode]];
        expect(deltaE(x, y, 'normal'), `${a.id}/${b.id} normal`).toBeGreaterThanOrEqual(15);
        expect(deltaE(x, y, 'protan'), `${a.id}/${b.id} protan`).toBeGreaterThanOrEqual(8);
        expect(deltaE(x, y, 'deutan'), `${a.id}/${b.id} deutan`).toBeGreaterThanOrEqual(8);
        expect(deltaE(x, y, 'tritan'), `${a.id}/${b.id} tritan`).toBeGreaterThanOrEqual(8);
      }
    });
  }

  it('reach 3:1 on the dark surface', () => {
    for (const s of sites) expect(contrast(s.color.dark, SURFACES.dark), s.id).toBeGreaterThanOrEqual(3);
  });

  it('reach 2:1 on the light surface (relief: end labels, legend and table view)', () => {
    for (const s of sites) expect(contrast(s.color.light, SURFACES.light), s.id).toBeGreaterThanOrEqual(2);
  });
});
