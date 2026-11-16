import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UmamiClient, UmamiError, bucketDay } from '../src/lib/umami.ts';
import { fakeFetch, json } from './helpers.ts';

const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/umami-pageviews.json'), 'utf8'));
const P = { startAt: 1, endAt: 2, timezone: 'Europe/Paris' };

function umami(handler: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch(handler);
  return { client: new UmamiClient({ url: 'https://stats.test', username: 'console', password: 'pw', fetchImpl: f.impl }), calls: f.calls };
}

describe('Umami bucket days', () => {
  it('take the date part, never shifting the literal Z', () => {
    expect(bucketDay('2026-11-16T00:00:00Z')).toBe('2026-11-16');
    expect(bucketDay('2026-11-16 00:00:00')).toBe('2026-11-16');
    expect(bucketDay('nope')).toBeUndefined();
    expect(bucketDay(17)).toBeUndefined();
  });
});

describe('Umami client', () => {
  it('logs in once and reads daily pageviews and sessions in Paris time', async () => {
    const { client, calls } = umami((url) => (url.pathname === '/api/auth/login' ? json({ token: 'tok', user: {} }) : json(fixture)));
    const a = await client.daily('site-1', P);
    await client.daily('site-2', P);
    expect(a.pageviews).toEqual([
      { day: '2026-11-14', value: 120 },
      { day: '2026-11-15', value: 98 },
      { day: '2026-11-16', value: 41 },
    ]);
    expect(a.sessions).toEqual([
      { day: '2026-11-14', value: 37 },
      { day: '2026-11-16', value: 12 },
    ]);
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
