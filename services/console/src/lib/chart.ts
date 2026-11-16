/**
 * Geometry of the line chart (one line per site, one point per day), computed on the
 * server and drawn as inline SVG by LineChart.astro. Pure functions, unit-tested.
 */

import { shortDay } from './dates.ts';

export interface ChartSeries {
  id: string;
  name: string;
  short: string;
  /** CSS colour value for the mark, e.g. var(--site-alt-web). */
  color: string;
  /** One value per day, or null when the series is missing. */
  values: number[] | null;
}

export interface ChartInput {
  days: string[];
  series: ChartSeries[];
  /** Unit for the point labels, singular and plural: ["visitor", "visitors"]. */
  unit: [string, string];
}

export const WIDTH = 960;
export const HEIGHT = 320;
export const MARGIN = { top: 16, right: 64, bottom: 30, left: 52 };
const LABEL_GAP = 14;

const numberFmt = new Intl.NumberFormat('en-GB');

/** Axis tick label: in full under 10,000 (1,000), compact on an axis that reaches it (10K). */
export function tickLabel(value: number, axisMax: number): string {
  if (axisMax >= 10_000) {
    if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  }
  return numberFmt.format(value);
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

/** A "nice" step (1, 2, 2.5, 5 × 10^k) giving about `count` ticks up to `max`. */
export function niceScale(max: number, count = 4): { step: number; max: number } {
  if (!(max > 0)) return { step: 1, max: count };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // Counts are whole numbers: never a step below 1.
  const multiples = mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  const step = Math.max(1, multiples.map((m) => m * mag).find((s) => s >= raw)!);
  return { step, max: Math.ceil(max / step) * step };
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  yTicks: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  lines: { id: string; color: string; points: string }[];
  dots: { id: string; color: string; x: number; y: number; title: string }[];
  endLabels: { id: string; color: string; text: string; x: number; y: number; lineY: number; leader: boolean }[];
  /** x of each day, for the hover layer. */
  columns: number[];
}

export function buildChart(input: ChartInput): ChartGeometry {
  const { days, series, unit } = input;
  const plot = { left: MARGIN.left, right: WIDTH - MARGIN.right, top: MARGIN.top, bottom: HEIGHT - MARGIN.bottom };
  const present = series.filter((s): s is ChartSeries & { values: number[] } => s.values !== null);
  const maxValue = Math.max(0, ...present.flatMap((s) => s.values));
  const scale = niceScale(maxValue);

  const n = days.length;
  const x = (i: number) => (n <= 1 ? (plot.left + plot.right) / 2 : plot.left + (i * (plot.right - plot.left)) / (n - 1));
  const y = (v: number) => plot.bottom - (v / scale.max) * (plot.bottom - plot.top);
  const r = (v: number) => Math.round(v * 10) / 10;

  const yTicks = [];
  for (let v = 0; v <= scale.max + 1e-9; v += scale.step) yTicks.push({ y: r(y(v)), label: tickLabel(v, scale.max) });

  // About six date labels, always the last day; never two too close together.
  const every = Math.max(1, Math.ceil(n / 6));
  const xLabels: { x: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i -= every) xLabels.unshift({ x: r(x(i)), label: shortDay(days[i]!) });
  if (xLabels.length > 1 && xLabels[1]!.x - xLabels[0]!.x < 40) xLabels.shift();

  const lines = present.map((s) => ({ id: s.id, color: s.color, points: s.values.map((v, i) => `${r(x(i))},${r(y(v))}`).join(' ') }));

  const dots = present.flatMap((s) =>
    s.values.map((v, i) => ({
      id: s.id,
      color: s.color,
      x: r(x(i)),
      y: r(y(v)),
      title: `${s.name}, ${shortDay(days[i]!)}: ${formatNumber(v)} ${v === 1 ? unit[0] : unit[1]}`,
    })),
  );

  // Direct labels at the line ends, spread apart; a leader line when a label had to move.
  const ends = present
    .map((s) => ({ id: s.id, color: s.color, text: s.short, lineY: r(y(s.values.at(-1) ?? 0)) }))
    .sort((a, b) => a.lineY - b.lineY);
  const placed: number[] = [];
  for (const e of ends) {
    const prev = placed.at(-1);
    placed.push(prev !== undefined && e.lineY - prev < LABEL_GAP ? prev + LABEL_GAP : e.lineY);
  }
  // Pushed past the bottom: shift the whole stack up.
  const overflow = (placed.at(-1) ?? 0) - plot.bottom;
  const endLabels = ends.map((e, i) => {
    const labelY = r(placed[i]! - Math.max(0, overflow));
    return { ...e, x: plot.right + 14, y: labelY, leader: Math.abs(labelY - e.lineY) > 3 };
  });

  return { width: WIDTH, height: HEIGHT, plot, yTicks, xLabels, lines, dots, endLabels, columns: days.map((_, i) => r(x(i))) };
}
