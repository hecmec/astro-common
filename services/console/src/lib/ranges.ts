/** Periods offered by the statistics pages (Visits, Search), kept in the page address as ?range=. */
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;

export function parseRange(value: string | null | undefined): Range {
  return RANGES.find((r) => String(r) === value) ?? DEFAULT_RANGE;
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
