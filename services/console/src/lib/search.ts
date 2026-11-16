import { type Range, sum } from './ranges.ts';
import type { DailyRow, QueryRow, SearchConsoleClient } from './search-console.ts';
import type { Site, Sites } from './sites.ts';

export const SEARCH_METRICS = ['clicks', 'impressions'] as const;
export type SearchMetric = (typeof SEARCH_METRICS)[number];
export const DEFAULT_SEARCH_METRIC: SearchMetric = 'clicks';

/** Figures stay an hour in memory (spec console-search, "Light on Search Console"). */
export const SEARCH_CACHE_TTL = 60 * 60 * 1000;
/** One daily request per site covers all ranges. */
export const HISTORY_DAYS = 100;
export const TOP_LIMIT = 25;

const DAY = 24 * 60 * 60 * 1000;

export function parseSearchMetric(value: string | null | undefined): SearchMetric {
  return SEARCH_METRICS.find((m) => m === value) ?? DEFAULT_SEARCH_METRIC;
}

/** YYYY-MM-DD shifted by whole days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export interface SiteSearch {
  site: Site;
  /** One value per day of `days`, or null when the site's data could not be read. */
  values: number[] | null;
  total: number | null;
}

export interface TopRow extends QueryRow {
  site: Site;
}

export interface SearchData {
  range: Range;
  metric: SearchMetric;
  /** The latest day Search Console has published (Google's Pacific Time days). */
  latestDay: string;
  days: string[];
  series: SiteSearch[];
  failed: Site[];
  unavailable: boolean;
  /** The site the top searches are limited to, if any. */
  site: Site | undefined;
  top: TopRow[];
  topFailed: Site[];
}

interface Cached<T> {
  at: number;
  value: T;
}

/** Search Console figures of the sites, asked on demand and kept an hour in memory. */
export class SearchService {
  private readonly client: SearchConsoleClient | undefined;
  private readonly sites: Sites;
  private readonly now: () => number;
  private readonly daily = new Map<string, Cached<DailyRow[]>>();
  private readonly tops = new Map<string, Cached<QueryRow[]>>();

  constructor(p: { client: SearchConsoleClient | undefined; sites: Sites; now?: () => number }) {
    this.client = p.client;
    this.sites = p.sites;
    this.now = p.now ?? Date.now;
  }

  private async cached<T>(map: Map<string, Cached<T>>, key: string, load: () => Promise<T>): Promise<T> {
    const hit = map.get(key);
    if (hit && this.now() - hit.at < SEARCH_CACHE_TTL) return hit.value;
    const value = await load(); // a failure throws and is not cached
    map.set(key, { at: this.now(), value });
    return value;
  }

  private property(site: Site): string {
    if (!site.searchConsole) throw new Error(`${site.id} has no Search Console property in sites.yaml`);
    return site.searchConsole;
  }

  private async dailyOf(site: Site): Promise<DailyRow[]> {
    const client = this.client;
    if (!client) throw new Error('Search Console is not configured');
    const end = new Date(this.now()).toISOString().slice(0, 10);
    return this.cached(this.daily, site.id, () => client.daily(this.property(site), addDays(end, -HISTORY_DAYS), end));
  }

  private async topOf(site: Site, start: string, end: string): Promise<QueryRow[]> {
    const client = this.client;
    if (!client) throw new Error('Search Console is not configured');
    return this.cached(this.tops, `${site.id}:${start}:${end}`, () => client.topQueries(this.property(site), start, end, TOP_LIMIT));
  }

  private static log(site: Site, what: string, reason: unknown) {
    console.error(`Search ${what} of ${site.id} unavailable:`, reason instanceof Error ? reason.message : reason);
  }

  async get(range: Range, metric: SearchMetric, siteId?: string): Promise<SearchData> {
    const settled = await Promise.allSettled(this.sites.map((s) => this.dailyOf(s)));
    const rows = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      SearchService.log(this.sites[i]!, 'figures', r.reason);
      return null;
    });
    // The period ends on the latest day any site has data for (Search Console lags 2-3 days).
    const seen = rows.flatMap((r) => r ?? []).map((r) => r.day);
    const latestDay = seen.length ? seen.reduce((a, b) => (b > a ? b : a)) : addDays(new Date(this.now()).toISOString().slice(0, 10), -3);
    const days = Array.from({ length: range }, (_, i) => addDays(latestDay, i - range + 1));

    const series = this.sites.map((site, i): SiteSearch => {
      const r = rows[i];
      if (!r) return { site, values: null, total: null };
      const byDay = new Map(r.map((x) => [x.day, x[metric]]));
      const values = days.map((d) => byDay.get(d) ?? 0); // days without impressions are absent
      return { site, values, total: sum(values) };
    });
    const failed = series.filter((s) => s.values === null).map((s) => s.site);
    const unavailable = failed.length === series.length;

    const site = siteId ? this.sites.find((s) => s.id === siteId) : undefined;
    let top: TopRow[] = [];
    let topFailed: Site[] = [];
    if (!unavailable) {
      const wanted = site ? [site] : this.sites;
      const results = await Promise.allSettled(wanted.map((s) => this.topOf(s, days[0]!, latestDay)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') top.push(...r.value.map((q) => ({ ...q, site: wanted[i]! })));
        else {
          SearchService.log(wanted[i]!, 'top searches', r.reason);
          topFailed.push(wanted[i]!);
        }
      });
      top = top.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, TOP_LIMIT);
    }
    return { range, metric, latestDay, days, series, failed, unavailable, site, top, topFailed };
  }
}
