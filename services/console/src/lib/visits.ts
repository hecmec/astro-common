import { TIMEZONE, lastDays, parisMidnight } from './dates.ts';
import { type Range, sum } from './ranges.ts';
import type { Site, Sites } from './sites.ts';
import type { DailyStats, UmamiClient } from './umami.ts';

export const METRICS = ['visitors', 'pageviews'] as const;
export type Metric = (typeof METRICS)[number];
export const DEFAULT_METRIC: Metric = 'visitors';

export const CACHE_TTL = 5 * 60 * 1000;

export function parseMetric(value: string | null | undefined): Metric {
  return METRICS.find((m) => m === value) ?? DEFAULT_METRIC;
}

export interface SiteSeries {
  site: Site;
  /** One value per day of `days`, or null when the site's statistics could not be read. */
  values: number[] | null;
  total: number | null;
}

export interface VisitsData {
  days: string[];
  range: Range;
  metric: Metric;
  series: SiteSeries[];
  /** Sites whose statistics could not be read. */
  failed: Site[];
  /** True when no site could be read (Umami down or not configured). */
  unavailable: boolean;
}

interface CacheEntry {
  at: number;
  days: string[];
  results: (DailyStats | null)[];
}

/** Daily visits of the sites from Umami, cached in memory for 5 minutes per range. */
export class VisitsService {
  private readonly umami: UmamiClient | undefined;
  private readonly sites: Sites;
  private readonly now: () => number;
  private readonly cache = new Map<Range, CacheEntry>();

  constructor(p: { umami: UmamiClient | undefined; sites: Sites; now?: () => number }) {
    this.umami = p.umami;
    this.sites = p.sites;
    this.now = p.now ?? Date.now;
  }

  private async fetchAll(range: Range): Promise<CacheEntry> {
    const now = this.now();
    const cached = this.cache.get(range);
    if (cached && now - cached.at < CACHE_TTL) return cached;
    const days = lastDays(now, range);
    const umami = this.umami;
    const settled = umami
      ? await Promise.allSettled(this.sites.map((s) => umami.daily(s.umamiId, { startAt: parisMidnight(days[0]!), endAt: now, timezone: TIMEZONE })))
      : this.sites.map(() => ({ status: 'rejected' as const, reason: new Error('Umami is not configured') }));
    const results = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.error(`Visits of ${this.sites[i]!.id} unavailable:`, r.reason instanceof Error ? r.reason.message : r.reason);
      return null;
    });
    const entry = { at: now, days, results };
    // Failures are not cached, so the next load tries again.
    if (results.some((r) => r !== null)) this.cache.set(range, entry);
    return entry;
  }

  async get(range: Range, metric: Metric): Promise<VisitsData> {
    const { days, results } = await this.fetchAll(range);
    const series = this.sites.map((site, i): SiteSeries => {
      const stats = results[i];
      if (!stats) return { site, values: null, total: null };
      const byDay = new Map((metric === 'visitors' ? stats.sessions : stats.pageviews).map((p) => [p.day, p.value]));
      const values = days.map((d) => byDay.get(d) ?? 0); // Umami omits days without visits
      return { site, values, total: sum(values) };
    });
    const failed = series.filter((s) => s.values === null).map((s) => s.site);
    return { days, range, metric, series, failed, unavailable: failed.length === series.length };
  }
}
