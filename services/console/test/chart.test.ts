import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import LineChart from '../src/components/LineChart.astro';
import { type ChartInput, buildChart, niceScale, tickLabel } from '../src/lib/chart.ts';

const days = ['2026-11-10', '2026-11-11', '2026-11-12'];
const input = (over: Partial<ChartInput> = {}): ChartInput => ({
  days,
  unit: ['visitor', 'visitors'],
  series: [
    { id: 'alt-web', name: 'Alt Web', short: 'AW', color: 'var(--site-alt-web)', values: [1, 37, 5] },
    { id: 'simplygoodfood', name: 'Simply Good Food', short: 'SGF', color: 'var(--site-simplygoodfood)', values: [10, 20, 30] },
    { id: 'bonetgratuit', name: 'Bon et gratuit', short: 'BG', color: 'var(--site-bonetgratuit)', values: null },
  ],
  ...over,
});

describe('chart scale', () => {
  it('uses whole, round steps from zero', () => {
    expect(niceScale(37)).toEqual({ step: 10, max: 40 });
    expect(niceScale(3)).toEqual({ step: 1, max: 3 });
    expect(niceScale(0)).toEqual({ step: 1, max: 4 });
    expect(niceScale(900)).toEqual({ step: 250, max: 1000 });
    expect(niceScale(12_345)).toEqual({ step: 5000, max: 15_000 });
  });

  it('labels ticks in full under 10,000 and compact above', () => {
    expect(tickLabel(2500, 5000)).toBe('2,500');
    expect(tickLabel(10_000, 15_000)).toBe('10K');
    expect(tickLabel(2500, 15_000)).toBe('2.5K');
    expect(tickLabel(0, 15_000)).toBe('0');
  });
});

describe('chart geometry', () => {
  it('draws one line per available site and one point per day', () => {
    const g = buildChart(input());
    expect(g.lines.map((l) => l.id)).toEqual(['alt-web', 'simplygoodfood']);
    expect(g.lines[0]!.points.split(' ')).toHaveLength(3);
    expect(g.dots).toHaveLength(6);
    expect(g.columns).toHaveLength(3);
    expect(g.yTicks.map((t) => t.label)).toEqual(['0', '10', '20', '30', '40']);
    expect(g.yTicks[0]!.y).toBe(g.plot.bottom);
  });

  it('titles each point with site, day and value', () => {
    const titles = buildChart(input()).dots.map((d) => d.title);
    expect(titles).toContain('Alt Web, 11 Nov: 37 visitors');
    expect(titles).toContain('Alt Web, 10 Nov: 1 visitor');
  });

  it('spreads end labels that would overlap and draws a leader line', () => {
    const g = buildChart(input({ series: [input().series[0]!, { ...input().series[1]!, values: [1, 2, 5] }] }));
    const [a, b] = g.endLabels;
    expect(Math.abs(a!.y - b!.y)).toBeGreaterThanOrEqual(14);
    expect(g.endLabels.some((e) => e.leader)).toBe(true);
    expect(g.endLabels.every((e) => e.y <= g.plot.bottom)).toBe(true);
  });

  it('copes with no data and a single day', () => {
    const empty = buildChart(input({ series: input().series.map((s) => ({ ...s, values: null })) }));
    expect(empty.lines).toEqual([]);
    expect(empty.yTicks.length).toBeGreaterThan(1);
    const one = buildChart(input({ days: ['2026-11-16'], series: [{ ...input().series[0]!, values: [4] }] }));
    expect(one.dots).toHaveLength(1);
    expect(one.xLabels).toEqual([{ x: one.columns[0], label: '16 Nov' }]);
  });

  it('labels about six days, the last one always', () => {
    const many = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 7, 19 + i)).toISOString().slice(0, 10));
    const g = buildChart(input({ days: many, series: [{ ...input().series[0]!, values: many.map(() => 1) }] }));
    expect(g.xLabels.length).toBeLessThanOrEqual(7);
    expect(g.xLabels.at(-1)!.label).toBe('16 Nov');
  });
});

describe('LineChart component', () => {
  it('renders inline SVG with titled points and the data for the tooltip', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(LineChart, { props: { input: input(), title: 'Daily visitors per site, last 3 days' } });
    expect(html).toContain('<svg');
    expect(html).toContain('aria-label="Daily visitors per site, last 3 days"');
    expect(html.match(/<polyline/g)).toHaveLength(2);
    expect(html.match(/data-point="alt-web"/g)).toHaveLength(3);
    expect(html).toContain('<title>Alt Web, 11 Nov: 37 visitors</title>');
    expect(html).toContain('stroke="var(--site-alt-web)"');
    expect(html).toContain('data-end-label="simplygoodfood"');
    expect(html).not.toContain('data-line="bonetgratuit"');
    expect(html).toContain('data-chart=');
  });
});
