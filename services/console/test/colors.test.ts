import { describe, expect, it } from 'vitest';
import { SURFACES, contrast, deltaE } from '../src/lib/colors.ts';
import { sites } from './helpers.ts';

/**
 * The site colours (spec admin-console, "The four sites"): in each theme, every pair is
 * distinguishable (chart lines cross, so any two colours can meet) and every colour is
 * readable. Thresholds of the dataviz palette method: OKLab ΔE×100 >= 15 in normal vision
 * and >= 8 under protan, deutan and tritan simulation; contrast >= 3:1 on the surface, or
 * >= 2:1 with relief (the chart's direct end labels, totals legend and table view).
 */
const modes = ['light', 'dark'] as const;
const pairs = sites.flatMap((a, i) => sites.slice(i + 1).map((b) => [a, b] as const));

describe('site colours', () => {
  it('reproduce the reference values of the formulas', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(deltaE('#2a78d6', '#2a78d6')).toBe(0);
    // validator reports (all pairs): light bordeaux/green deutan ΔE 10.3, dark bordeaux/green deutan 8.6
    expect(deltaE('#92123b', '#487c25', 'deutan')).toBeCloseTo(10.3, 1);
    expect(deltaE('#aa4964', '#478809', 'deutan')).toBeCloseTo(8.6, 1);
    expect(pairs).toHaveLength(6);
  });

  for (const mode of modes) {
    it(`are distinguishable for every pair, also with colour-vision deficiencies (${mode})`, () => {
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
