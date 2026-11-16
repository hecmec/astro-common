import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEARCH_CACHE_TTL, SearchService, addDays, parseSearchMetric } from '../src/lib/search.ts';
import type { DailyRow, QueryRow, SearchConsoleClient } from '../src/lib/search-console.ts';
import { SearchConsoleError } from '../src/lib/search-console.ts';
import { sites } from './helpers.ts';

const NOW = Date.parse('2026-11-16T10:00:00Z');
const prop = (id: string) => sites.find((s) => s.id === id)!.searchConsole!;

/** Fake client: daily rows up to 13 November (three days of delay), per property. */
function fakeClient(opts: { fail?: string[]; latest?: string; empty?: boolean } = {}) {
  const calls: { kind: string; property: string; start: string; end: string }[] = [];
  const latest = opts.latest ?? '2026-11-13';
  const level: Record<string, number> = Object.fromEntries(sites.map((s, i) => [s.searchConsole!, (i + 1) * 10]));
  const client = {
    async daily(property: string, start: string, end: string): Promise<DailyRow[]> {
      calls.push({ kind: 'daily', property, start, end });
      if (opts.fail?.includes(property)) throw new SearchConsoleError(`Search Console answered 403 for ${property}`, 403);
      if (opts.empty) return [];
      const rows: DailyRow[] = [];
      for (let d = addDays(latest, -99); d <= latest; d = addDays(d, 1)) {
        if (d === '2026-11-10') continue; // a day without impressions
        rows.push({ day: d, clicks: level[property]! / 10, impressions: level[property]! });
      }
      return rows;
    },
    async topQueries(property: string, start: string, end: string): Promise<QueryRow[]> {
      calls.push({ kind: 'top', property, start, end });
      if (opts.fail?.includes(property)) throw new SearchConsoleError('403', 403);
      const n = level[property]!;
      return [
        { query: `${property} best`, clicks: n, impressions: n * 10, ctr: 0.1, position: 3.2 },
        { query: `${property} other`, clicks: n / 2, impressions: n * 20, ctr: 0.025, position: 8.5 },
      ];
    },
  } as unknown as SearchConsoleClient;
  return { client, calls };
}

describe('search figures', () => {
  it('parse the metric with clicks by default', () => {
    expect([parseSearchMetric('impressions'), parseSearchMetric('x'), parseSearchMetric(null)]).toEqual(['impressions', 'clicks', 'clicks']);
    expect(addDays('2026-11-13', -6)).toBe('2026-11-07');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('end the period on the latest published day: 7 days are 7 to 13 November', async () => {
    const { client, calls } = fakeClient();
    const data = await new SearchService({ client, sites, now: () => NOW }).get(7, 'clicks');
    expect(data.latestDay).toBe('2026-11-13');
    expect(data.days).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(calls.filter((c) => c.kind === 'daily')[0]).toMatchObject({ start: '2026-08-08', end: '2026-11-16' });
  });

  it('give one value per day per site, zero for days without data, and totals per metric', async () => {
    const { client } = fakeClient();
    const s = new SearchService({ client, sites, now: () => NOW });
    const clicks = await s.get(7, 'clicks');
    expect(clicks.series.map((x) => x.site.id)).toEqual(sites.map((x) => x.id));
    expect(clicks.series[0]!.values).toEqual([1, 1, 1, 0, 1, 1, 1]);
    expect(clicks.series[0]!.total).toBe(6);
    const impressions = await s.get(7, 'impressions');
    expect(impressions.series[1]!.values).toEqual([20, 20, 20, 0, 20, 20, 20]);
    expect(impressions.series[1]!.total).toBe(120);
  });

  it('list the top searches of all sites, most clicks first, 25 at most, each with its site', async () => {
    const { client, calls } = fakeClient();
    const data = await new SearchService({ client, sites, now: () => NOW }).get(30, 'clicks');
    expect(data.top).toHaveLength(8);
    expect(data.top[0]).toMatchObject({ query: `${sites[3]!.searchConsole} best`, clicks: 40, site: { id: sites[3]!.id } });
    expect(data.top.map((t) => t.clicks)).toEqual([...data.top.map((t) => t.clicks)].sort((a, b) => b - a));
    expect(calls.filter((c) => c.kind === 'top')[0]).toMatchObject({ start: '2026-10-15', end: '2026-11-13' });
  });

  it('limit the top searches to one site, the chart keeping all four', async () => {
    const { client, calls } = fakeClient();
    const data = await new SearchService({ client, sites, now: () => NOW }).get(30, 'clicks', 'alt-web');
    expect(data.site?.id).toBe('alt-web');
    expect(new Set(data.top.map((t) => t.site.id))).toEqual(new Set(['alt-web']));
    expect(data.series.filter((s) => s.values)).toHaveLength(4);
    expect(calls.filter((c) => c.kind === 'top').map((c) => c.property)).toEqual([prop('alt-web')]);
  });

  it('serve reloads within an hour from memory', async () => {
    let now = NOW;
    const { client, calls } = fakeClient();
    const s = new SearchService({ client, sites, now: () => now });
    await s.get(30, 'clicks');
    const first = calls.length;
    now += 60_000;
    await s.get(30, 'clicks');
    await s.get(30, 'impressions');
    await s.get(7, 'clicks'); // daily series shared; only the 7-day top searches are new
    expect(calls.length).toBe(first + 4);
    now = NOW + SEARCH_CACHE_TTL;
    await s.get(30, 'clicks');
    expect(calls.length).toBe(first + 4 + 8);
  });

  it('leave out a property not shared with the console and name it', async () => {
    const { client } = fakeClient({ fail: [prop('bonetgratuit')] });
    const data = await new SearchService({ client, sites, now: () => NOW }).get(7, 'clicks');
    expect(data.failed.map((s) => s.id)).toEqual(['bonetgratuit']);
    expect(data.series.find((s) => s.site.id === 'bonetgratuit')).toMatchObject({ values: null, total: null });
    expect(data.unavailable).toBe(false);
    expect(data.topFailed.map((s) => s.id)).toEqual(['bonetgratuit']);
  });

  it('are unavailable when every site fails or no key is configured, and do not cache failures', async () => {
    const { client, calls } = fakeClient({ fail: sites.map((s) => s.searchConsole!) });
    const s = new SearchService({ client, sites, now: () => NOW });
    expect((await s.get(7, 'clicks')).unavailable).toBe(true);
    await s.get(7, 'clicks');
    expect(calls.filter((c) => c.kind === 'daily')).toHaveLength(8);
    const none = await new SearchService({ client: undefined, sites, now: () => NOW }).get(7, 'clicks');
    expect(none).toMatchObject({ unavailable: true, top: [] });
  });

  it('fall back to three days ago when the sites have no data yet', async () => {
    const { client } = fakeClient({ empty: true });
    const data = await new SearchService({ client, sites, now: () => NOW }).get(7, 'clicks');
    expect(data.latestDay).toBe('2026-11-13');
    expect(data.series[0]!.values).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('search figures from a recorded response', () => {
  it('end on the latest recorded day and count days without data as zero', async () => {
    const rec = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/search-console/simplygoodfood-date.json'), 'utf8'));
    const rows = rec.response.rows.map((r: { keys: string[]; clicks: number; impressions: number }) => ({ day: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
    const client = { daily: async () => rows, topQueries: async () => [] } as unknown as SearchConsoleClient;
    const data = await new SearchService({ client, sites, now: () => Date.parse(`${rec.request.endDate}T10:00:00Z`) }).get(30, 'impressions');
    expect(data.latestDay).toBe(rows.at(-1).day);
    const values = data.series[0]!.values!;
    expect(values).toHaveLength(30);
    expect(values.at(-1)).toBe(rows.at(-1).impressions);
    const inRange = rows.filter((r: { day: string }) => r.day >= data.days[0]!);
    expect(data.series[0]!.total).toBe(inRange.reduce((a: number, r: { impressions: number }) => a + r.impressions, 0));
  });
});
