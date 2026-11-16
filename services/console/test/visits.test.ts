import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lastDays, parisDay, parisMidnight } from '../src/lib/dates.ts';
import type { UmamiClient } from '../src/lib/umami.ts';
import { CACHE_TTL, VisitsService, parseMetric, parseRange } from '../src/lib/visits.ts';
import { sites } from './helpers.ts';

const NOW = Date.parse('2026-11-16T09:30:00Z'); // 10:30 in Paris

function fakeUmami(fail: string[] = []) {
  const calls: { id: string; startAt: number; endAt: number; timezone: string }[] = [];
  const umami = {
    daily: async (id: string, p: { startAt: number; endAt: number; timezone: string }) => {
      calls.push({ id, ...p });
      if (fail.includes(id)) throw new Error('Umami answered 500');
      return {
        sessions: [
          { day: '2026-11-16', value: 3 },
          { day: '2026-11-14', value: 2 },
        ],
        pageviews: [{ day: '2026-11-16', value: 10 }],
      };
    },
  } as unknown as UmamiClient;
  return { umami, calls };
}

describe('Paris days', () => {
  it('end with today and start at Paris midnight, across the DST change', () => {
    expect(lastDays(NOW, 7)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
    expect(lastDays(NOW, 90)).toHaveLength(90);
    expect(new Date(parisMidnight('2026-11-16')).toISOString()).toBe('2026-11-15T23:00:00.000Z'); // CET
    expect(new Date(parisMidnight('2026-07-01')).toISOString()).toBe('2026-06-30T22:00:00.000Z'); // CEST
    expect(new Date(parisMidnight('2026-10-25')).toISOString()).toBe('2026-10-24T22:00:00.000Z'); // DST ends that day
    expect(parisDay(Date.parse('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
  });
});

describe('visits from a recorded Umami response', () => {
  it('fill the days Umami left out with zero and total the rest', async () => {
    const rec = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/umami/anglais-gratuit-90.json'), 'utf8'));
    const endAt = Number(rec.query.endAt);
    const umami = {
      daily: async () => ({
        pageviews: rec.response.pageviews.map((b: { x: string; y: number }) => ({ day: b.x.slice(0, 10), value: b.y })),
        sessions: rec.response.sessions.map((b: { x: string; y: number }) => ({ day: b.x.slice(0, 10), value: b.y })),
      }),
    } as unknown as UmamiClient;
    const data = await new VisitsService({ umami, sites, now: () => endAt }).get(90, 'visitors');
    const values = data.series[0]!.values!;
    expect(values).toHaveLength(90);
    expect(values.filter((v) => v > 0)).toHaveLength(rec.response.sessions.length);
    expect(data.series[0]!.total).toBe(rec.response.sessions.reduce((a: number, b: { y: number }) => a + b.y, 0));
    expect(values.at(-1)).toBe(rec.response.sessions.at(-1).y); // today, counted so far
  });
});

describe('visits', () => {
  it('parse range and metric with defaults', () => {
    expect([parseRange('7'), parseRange('90'), parseRange('31'), parseRange(null)]).toEqual([7, 90, 30, 30]);
    expect([parseMetric('pageviews'), parseMetric('x'), parseMetric(null)]).toEqual(['pageviews', 'visitors', 'visitors']);
  });

  it('give one value per day for each site, zero for days without visits, and totals', async () => {
    const { umami, calls } = fakeUmami();
    const v = new VisitsService({ umami, sites, now: () => NOW });
    const data = await v.get(7, 'visitors');
    expect(data.days).toHaveLength(7);
    expect(data.series.map((s) => s.site.id)).toEqual(sites.map((s) => s.id));
    expect(data.series[0]!.values).toEqual([0, 0, 0, 0, 2, 0, 3]);
    expect(data.series[0]!.total).toBe(5);
    expect(data.unavailable).toBe(false);
    expect(calls).toHaveLength(4);
    expect(calls[0]).toMatchObject({ startAt: parisMidnight('2026-11-10'), endAt: NOW, timezone: 'Europe/Paris' });
    const pv = await v.get(7, 'pageviews');
    expect(pv.series[0]!.values).toEqual([0, 0, 0, 0, 0, 0, 10]);
  });

  it('serve the same range from memory for 5 minutes', async () => {
    const { umami, calls } = fakeUmami();
    let now = NOW;
    const v = new VisitsService({ umami, sites, now: () => now });
    await v.get(30, 'visitors');
    now += 60_000;
    await v.get(30, 'visitors');
    await v.get(30, 'pageviews');
    expect(calls).toHaveLength(4); // first load only
    now = NOW + CACHE_TTL;
    await v.get(30, 'visitors');
    expect(calls).toHaveLength(8);
    await v.get(90, 'visitors');
    expect(calls).toHaveLength(12); // another range
  });

  it('keep the other sites when one fails, and name it', async () => {
    const bg = sites.find((s) => s.id === 'bonetgratuit')!;
    const { umami } = fakeUmami([bg.umamiId]);
    const data = await new VisitsService({ umami, sites, now: () => NOW }).get(7, 'visitors');
    expect(data.failed.map((s) => s.id)).toEqual(['bonetgratuit']);
    expect(data.series.find((s) => s.site.id === 'bonetgratuit')).toMatchObject({ values: null, total: null });
    expect(data.unavailable).toBe(false);
  });

  it('are unavailable when Umami is down or not configured, and do not cache the failure', async () => {
    const { umami, calls } = fakeUmami(sites.map((s) => s.umamiId));
    const v = new VisitsService({ umami, sites, now: () => NOW });
    expect((await v.get(7, 'visitors')).unavailable).toBe(true);
    await v.get(7, 'visitors');
    expect(calls).toHaveLength(8);
    expect((await new VisitsService({ umami: undefined, sites, now: () => NOW }).get(7, 'visitors')).unavailable).toBe(true);
  });
});
