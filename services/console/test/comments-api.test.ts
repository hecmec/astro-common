import { describe, expect, it } from 'vitest';
import { CommentsApi, CommentsApiError, CommentsUnavailable } from '../src/lib/comments-api.ts';
import { fakeFetch, json } from './helpers.ts';

const TOKEN = 't'.repeat(40);

describe('comments API client', () => {
  it('sends the bearer token and the filters', async () => {
    const f = fakeFetch(() => json({ comments: [], counts: { pending: 0, published: 0, refused: 0 } }));
    const api = new CommentsApi({ baseUrl: 'https://comments.test', token: TOKEN, fetchImpl: f.impl });
    await api.comments({ status: 'published', site: 'alt-web', path: '/a/' });
    const { url, init } = f.calls[0]!;
    expect(url.href).toBe('https://comments.test/api/admin/v1/comments?status=published&site=alt-web&path=%2Fa%2F');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('posts actions and sends replies as JSON', async () => {
    const f = fakeFetch(() => json({ comment: { id: 3 } }));
    const api = new CommentsApi({ baseUrl: 'https://comments.test', token: TOKEN, fetchImpl: f.impl });
    await api.act(3, 'publish');
    await api.reply(3, 'Thanks');
    await api.user(9, 'block');
    await api.runRebuilds();
    expect(f.calls.map((c) => `${c.init.method} ${c.url.pathname}`)).toEqual([
      'POST /api/admin/v1/comments/3/publish',
      'PUT /api/admin/v1/comments/3/reply',
      'POST /api/admin/v1/users/9/block',
      'POST /api/admin/v1/rebuilds',
    ]);
    expect(JSON.parse(String(f.calls[1]!.init.body))).toEqual({ body: 'Thanks' });
  });

  it('reports refusals with their status', async () => {
    const api = new CommentsApi({ baseUrl: 'https://c.test', token: TOKEN, fetchImpl: fakeFetch(() => json({ error: 'not_published' }, 409)).impl });
    const err = await api.act(1, 'sticky').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CommentsApiError);
    expect(err).toMatchObject({ status: 409, code: 'not_published' });
  });

  it('treats an unreachable service, 5xx, 401, a missing admin API and no token as unavailable', async () => {
    const cases: [typeof fetch, string?][] = [
      [fakeFetch(() => Promise.reject(new TypeError('fetch failed'))).impl],
      [fakeFetch(() => json({ error: 'internal_error' }, 500)).impl],
      [fakeFetch(() => json({ error: 'unauthorized' }, 401)).impl],
      [fakeFetch(() => json({ error: 'not_found' }, 404)).impl],
      [fakeFetch(() => new Response('<html>', { status: 200 })).impl],
      [fakeFetch(() => json({})).impl, ''],
    ];
    for (const [impl, token] of cases) {
      const api = new CommentsApi({ baseUrl: 'https://c.test', token: token ?? TOKEN, fetchImpl: impl });
      await expect(api.summary()).rejects.toBeInstanceOf(CommentsUnavailable);
    }
  });

  it('gives up after its timeout', async () => {
    const slow = (async (_: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
    const api = new CommentsApi({ baseUrl: 'https://c.test', token: TOKEN, fetchImpl: slow, timeoutMs: 20 });
    await expect(api.summary()).rejects.toBeInstanceOf(CommentsUnavailable);
  });
});
