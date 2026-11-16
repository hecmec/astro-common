import { createVerify, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCOPE, SearchConsoleClient, SearchConsoleError, signAssertion } from '../src/lib/search-console.ts';
import { fakeFetch, json } from './helpers.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const EMAIL = 'console@project.iam.gserviceaccount.com';
const TOKEN_URL = 'https://oauth2.test/token';
const API = 'https://searchconsole.test';
const NOW = Date.parse('2026-11-16T10:00:00Z');

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

function client(handler: Parameters<typeof fakeFetch>[0], now = () => NOW) {
  const f = fakeFetch(handler);
  return { c: new SearchConsoleClient({ clientEmail: EMAIL, privateKey, apiUrl: API, tokenUrl: TOKEN_URL, fetchImpl: f.impl, now }), calls: f.calls };
}

const token = (value = 'ya29.tok', expires = 3599) => json({ access_token: value, expires_in: expires, token_type: 'Bearer' });

describe('service-account assertion', () => {
  it('is an RS256 JWT for the read-only Search Console scope, valid one hour, verifiable with the public key', () => {
    const jwt = signAssertion({ clientEmail: EMAIL, privateKey, tokenUrl: TOKEN_URL, now: NOW });
    const [h, c, s] = jwt.split('.') as [string, string, string];
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(c)).toEqual({ iss: EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: NOW / 1000, exp: NOW / 1000 + 3600 });
    expect(SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('access token', () => {
  it('is fetched with the JWT bearer grant and reused until five minutes before expiry', async () => {
    let now = NOW;
    let issued = 0;
    const { c, calls } = client(() => token(`tok${++issued}`), () => now);
    expect(await c.accessToken()).toBe('tok1');
    const body = new URLSearchParams(String(calls[0]!.init.body));
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(body.get('assertion')!.split('.')).toHaveLength(3);
    now += 50 * 60_000;
    expect(await c.accessToken()).toBe('tok1');
    now += 5 * 60_000; // 55 minutes: within five minutes of expiry
    expect(await c.accessToken()).toBe('tok2');
  });

  it('is fetched once for parallel requests', async () => {
    const { c, calls } = client((url) => (url.href === TOKEN_URL ? token() : json({ rows: [] })));
    await Promise.all([c.daily('sc-domain:a.org', '2026-11-01', '2026-11-13'), c.daily('sc-domain:b.org', '2026-11-01', '2026-11-13')]);
    expect(calls.filter((x) => x.url.href === TOKEN_URL)).toHaveLength(1);
  });

  it('reports a refused exchange', async () => {
    const { c } = client(() => json({ error: 'invalid_grant' }, 400));
    await expect(c.accessToken()).rejects.toThrow('Google token endpoint answered 400 (invalid_grant)');
  });
});

describe('Search Analytics queries', () => {
  const daily = { rows: [{ keys: ['2026-11-12'], clicks: 3, impressions: 120, ctr: 0.025, position: 9.4 }, { keys: ['2026-11-13'], clicks: 0, impressions: 41, ctr: 0, position: 12 }], responseAggregationType: 'byProperty' };

  it('ask for daily clicks and impressions of a domain property', async () => {
    const { c, calls } = client((url) => (url.href === TOKEN_URL ? token() : json(daily)));
    expect(await c.daily('sc-domain:alt-web.org', '2026-08-07', '2026-11-16')).toEqual([
      { day: '2026-11-12', clicks: 3, impressions: 120 },
      { day: '2026-11-13', clicks: 0, impressions: 41 },
    ]);
    const q = calls[1]!;
    expect(q.url.href).toBe(`${API}/webmasters/v3/sites/sc-domain%3Aalt-web.org/searchAnalytics/query`);
    expect(q.init.method).toBe('POST');
    expect(new Headers(q.init.headers).get('authorization')).toBe('Bearer ya29.tok');
    expect(JSON.parse(String(q.init.body))).toEqual({ type: 'web', startDate: '2026-08-07', endDate: '2026-11-16', dimensions: ['date'], rowLimit: 1000 });
  });

  it('ask for the top searches', async () => {
    const rows = { rows: [{ keys: ['repair cafe'], clicks: 12, impressions: 300, ctr: 0.04, position: 4.2 }] };
    const { c, calls } = client((url) => (url.href === TOKEN_URL ? token() : json(rows)));
    expect(await c.topQueries('sc-domain:alt-web.org', '2026-10-15', '2026-11-13')).toEqual([{ query: 'repair cafe', clicks: 12, impressions: 300, ctr: 0.04, position: 4.2 }]);
    expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({ dimensions: ['query'], rowLimit: 25 });
  });

  it('give no rows when the period has no data', async () => {
    const { c } = client((url) => (url.href === TOKEN_URL ? token() : json({ responseAggregationType: 'byProperty' })));
    expect(await c.daily('sc-domain:a.org', '2026-11-01', '2026-11-13')).toEqual([]);
  });

  it('report a property not shared with the account, a server error and odd answers', async () => {
    const forbidden = client((url) => (url.href === TOKEN_URL ? token() : json({ error: { code: 403 } }, 403)));
    const err = await forbidden.c.daily('sc-domain:bon-et-gratuit.fr', '2026-11-01', '2026-11-13').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SearchConsoleError);
    expect(err).toMatchObject({ status: 403, message: 'Search Console answered 403 for sc-domain:bon-et-gratuit.fr' });
    await expect(client((url) => (url.href === TOKEN_URL ? token() : json({}, 500))).c.daily('p', 'a', 'b')).rejects.toThrow('answered 500');
    await expect(client((url) => (url.href === TOKEN_URL ? token() : json({ rows: [{ keys: ['nope'], clicks: 1, impressions: 1 }] }))).c.daily('p', 'a', 'b')).rejects.toThrow('Unexpected Search Console date');
    await expect(client((url) => (url.href === TOKEN_URL ? token() : Promise.reject(new TypeError('fetch failed')))).c.daily('p', 'a', 'b')).rejects.toThrow('Search Console unreachable');
  });

  it('sign in again after a 401', async () => {
    let issued = 0;
    let first = true;
    const { c } = client((url) => {
      if (url.href === TOKEN_URL) return token(`tok${++issued}`);
      if (first) return ((first = false), json({}, 401));
      return json({ rows: [] });
    });
    await expect(c.daily('p', 'a', 'b')).rejects.toThrow('401');
    await c.daily('p', 'a', 'b');
    expect(issued).toBe(2);
  });
});

describe('recorded Search Console responses', () => {
  const recorded = (name: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, `fixtures/search-console/${name}.json`), 'utf8'));

  for (const site of ['alt-web', 'simplygoodfood']) {
    it(`read ${site}'s daily clicks and impressions`, async () => {
      const rec = recorded(`${site}-date`);
      const { c } = client((url) => (url.href === TOKEN_URL ? token() : json(rec.response)));
      const days = await c.daily('p', rec.request.startDate, rec.request.endDate);
      expect(days).toEqual(rec.response.rows.map((r: { keys: string[]; clicks: number; impressions: number }) => ({ day: r.keys[0], clicks: r.clicks, impressions: r.impressions })));
      expect(days.length).toBeGreaterThan(0);
      expect(days.map((d) => d.day)).toEqual([...days.map((d) => d.day)].sort()); // oldest first
      for (const d of days) expect(d.clicks).toBeLessThanOrEqual(d.impressions);
    });

    it(`read ${site}'s top searches, most clicks first`, async () => {
      const rec = recorded(`${site}-query`);
      const { c } = client((url) => (url.href === TOKEN_URL ? token() : json(rec.response)));
      const rows = await c.topQueries('p', rec.request.startDate, rec.request.endDate);
      expect(rows).toHaveLength(rec.response.rows.length);
      expect(rows.length).toBeLessThanOrEqual(25);
      expect(rows.map((r) => r.clicks)).toEqual([...rows.map((r) => r.clicks)].sort((a, b) => b - a));
      for (const r of rows) {
        expect(r.ctr).toBeGreaterThanOrEqual(0);
        expect(r.ctr).toBeLessThanOrEqual(1);
        expect(r.position).toBeGreaterThan(0);
      }
    });
  }
});
