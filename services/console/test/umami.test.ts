import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UmamiClient, UmamiError, bucketDay } from '../src/lib/umami.ts';
import { fakeFetch, json } from './helpers.ts';

/** Responses recorded from stats.babelcoach.com (test/fixtures/umami). */
const recorded = (name: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, `fixtures/umami/${name}.json`), 'utf8')) as {
    query: Record<string, string>;
    response: { pageviews: { x: string; y: number }[]; sessions: { x: string; y: number }[] };
  };
const ag90 = recorded('anglais-gratuit-90');
const aw7 = recorded('alt-web-7');
const fixture = aw7.response;
const P = { startAt: 1, endAt: 2, timezone: 'Europe/Paris' };

function umami(handler: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch(handler);
  return { client: new UmamiClient({ url: 'https://stats.test', username: 'console', password: 'pw', fetchImpl: f.impl }), calls: f.calls };
}

describe('Umami bucket days', () => {
  it('take the date part, in the format of stats.babelcoach.com and of newer Umami versions', () => {
    expect(bucketDay('2026-11-16 00:00:00')).toBe('2026-11-16'); // stats.babelcoach.com
    expect(bucketDay('2026-11-16T00:00:00Z')).toBe('2026-11-16'); // newer source: literal Z, not UTC
    expect(bucketDay('nope')).toBeUndefined();
    expect(bucketDay(17)).toBeUndefined();
  });
});

describe('Umami client', () => {
  it('reads the recorded responses: one point per bucket, the day of x, the value of y', async () => {
    for (const rec of [ag90, aw7]) {
      const { client } = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 'tok' }) : json(rec.response)));
      const stats = await client.daily('site', P);
      for (const key of ['pageviews', 'sessions'] as const) {
        expect(stats[key]).toEqual(rec.response[key].map((b) => ({ day: b.x.slice(0, 10), value: b.y })));
        for (const p of stats[key]) expect(Number.isInteger(p.value) && p.value >= 0).toBe(true);
      }
      // a visitor makes at least one pageview
      const pv = new Map(stats.pageviews.map((p) => [p.day, p.value]));
      for (const s of stats.sessions) expect(s.value).toBeLessThanOrEqual(pv.get(s.day) ?? 0);
    }
    // Umami leaves out days without visits: the 90-day recording has gaps
    const days = ag90.response.pageviews.map((b) => b.x.slice(0, 10));
    expect(days.length).toBeLessThan(90);
    expect(days).toEqual([...days].sort());
  });

  it('logs in once and asks for days in Paris time', async () => {
    const { client, calls } = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 'tok', user: {} }) : json(fixture)));
    await client.daily('site-1', P);
    await client.daily('site-2', P);
    expect(calls.map((c) => c.url.pathname)).toEqual(['/api/auth/login', '/api/websites/site-1/pageviews', '/api/websites/site-2/pageviews']);
    expect(Object.fromEntries(calls[1]!.url.searchParams)).toEqual({ startAt: '1', endAt: '2', unit: 'day', timezone: 'Europe/Paris' });
    expect(new Headers(calls[1]!.init.headers).get('authorization')).toBe('Bearer tok');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ username: 'console', password: 'pw' });
  });

  it('shares one login between parallel requests', async () => {
    const { client, calls } = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 'tok' }) : json(fixture)));
    await Promise.all([client.daily('a', P), client.daily('b', P), client.daily('c', P)]);
    expect(calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(1);
  });

  it('logs in again once on 401, then gives up', async () => {
    let tokens = 0;
    const first = umami((url, init) => {
      if (url.pathname === '/api/auth/login') return json({ token: `tok${++tokens}` });
      return new Headers(init.headers).get('authorization') === 'Bearer tok1' ? json({}, 401) : json(fixture);
    });
    await expect(first.client.daily('a', P)).resolves.toMatchObject({ pageviews: expect.any(Array) });
    expect(tokens).toBe(2);

    const always = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 'x' }) : json({}, 401)));
    await expect(always.client.daily('a', P)).rejects.toThrow('Umami answered 401');
    expect(always.calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(2);
  });

  it('reports a failed login, two-factor accounts and unexpected answers', async () => {
    await expect(umami(() => json({}, 401)).client.daily('a', P)).rejects.toThrow('Umami login answered 401');
    await expect(umami(() => json({ requiresTwoFactor: true, partialToken: 'p' })).client.daily('a', P)).rejects.toThrow('two-factor');
    const odd = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 't' }) : json({ pageviews: [{ x: 'today', y: 1 }], sessions: [] })));
    await expect(odd.client.daily('a', P)).rejects.toBeInstanceOf(UmamiError);
    const down = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 't' }) : Promise.reject(new TypeError('fetch failed'))));
    await expect(down.client.daily('a', P)).rejects.toThrow('Umami unreachable');
  });
});
