import { describe, expect, it } from 'vitest';
import { Rebuilder } from '../src/rebuild.ts';
import { parseSites } from '../src/sites.ts';
import { ALT, SITES_YAML, page, post, setup } from './helpers.ts';

const TOKEN = 'console-token-0123456789abcdef0123456789';

function withApi(opts: { rebuild?: 'off' | 'ok' } = {}) {
  const deployed: string[] = [];
  const yaml = SITES_YAML.replace('    bake_after_days: 7\n', '    bake_after_days: 7\n    rebuild: { coolify_app: altwebprod0001 }\n');
  const s = setup({
    consoleToken: TOKEN,
    rebuilder:
      opts.rebuild === 'ok'
        ? ({ db, now }) =>
            new Rebuilder({ db, sites: parseSites(yaml, { allowDevOrigins: false }), now, at: '03:30', deploy: async (uuid) => void deployed.push(uuid) })
        : undefined,
  });
  const call = (path: string, init: { method?: string; json?: unknown; token?: string | null } = {}) => {
    const headers = new Headers();
    const token = init.token === undefined ? TOKEN : init.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (init.json !== undefined) headers.set('content-type', 'application/json');
    return s.app.request(`/api/admin/v1${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  };
  const json = async (path: string, init: Parameters<typeof call>[1] = {}) => {
    const res = await call(path, init);
    return { status: res.status, body: (await res.json()) as any };
  };
  return { ...s, call, json, deployed };
}

describe('admin API authentication', () => {
  it('serves requests with the console token', async () => {
    const a = withApi();
    expect((await a.call('/summary')).status).toBe(200);
  });

  it('answers 401 to a wrong or missing token and changes nothing', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org');
    const id = await post(a, token);
    expect((await a.call('/summary', { token: 'nope' })).status).toBe(401);
    expect((await a.call('/summary', { token: null })).status).toBe(401);
    expect((await a.call(`/comments/${id}/publish`, { method: 'POST', token: `${TOKEN}x` })).status).toBe(401);
    expect((await page(a, '/tag/vrac/')).comments).toEqual([]); // still pending
  });

  it('does not exist without a configured token', async () => {
    const s = setup();
    for (const path of ['/summary', '/comments', '/rebuilds', '/anything']) {
      const res = await s.app.request(`/api/admin/v1${path}`, { headers: { authorization: 'Bearer ' } });
      expect(res.status).toBe(404);
    }
  });

  it('sends no CORS headers, even to an allowed site origin', async () => {
    const a = withApi();
    const res = await a.app.request('/api/admin/v1/summary', { headers: { authorization: `Bearer ${TOKEN}`, origin: ALT } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await a.app.request('/api/admin/v1/summary', { method: 'OPTIONS', headers: { origin: ALT, 'access-control-request-method': 'GET' } });
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('summary and list', () => {
  it('counts comments per site and for all sites', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org');
    await post(a, token, 'one');
    await post(a, token, 'two');
    const sgf = a.reader('bob@example.org', 'simplygoodfood');
    const res = await a.api('/api/v1/sites/simplygoodfood/comments', {
      method: 'POST',
      token: sgf.token,
      origin: 'https://www.simplygoodfood.eu',
      json: { path: '/r/soup/', body: 'tasty', lang: 'en' },
    });
    expect(res.status).toBe(201);
    const { body } = await a.json('/summary');
    expect(body.sites['alt-web']).toMatchObject({ name: 'Alt Web', pending: 2, published: 0, refused: 0 });
    expect(body.sites.simplygoodfood).toMatchObject({ pending: 1 });
    expect(body.all).toEqual({ pending: 3, published: 0, refused: 0 });
  });

  it('lists pending comments of a site oldest first with the counts of that site', async () => {
    const a = withApi();
    const ana = a.reader('ana@example.org', 'alt-web', 'Ana');
    const first = await post(a, ana.token, 'first');
    a.advance(1000);
    const second = await post(a, ana.token, 'second', '/other/');
    a.advance(1000);
    await a.json(`/comments/${second}/publish`, { method: 'POST' });
    const third = await post(a, ana.token, 'third');

    const { status, body } = await a.json('/comments?site=alt-web');
    expect(status).toBe(200);
    expect(body.comments.map((c: { id: number }) => c.id)).toEqual([first, third]);
    expect(body.comments[0]).toMatchObject({
      site: 'alt-web',
      path: '/tag/vrac/',
      url: 'https://www.alt-web.org/tag/vrac/',
      lang: 'en',
      status: 'pending',
      author: 'Ana',
      email: 'ana@example.org',
      user_id: ana.user.id,
      blocked: false,
      sticky: false,
      body: 'first',
      reply: null,
    });
    expect(body.comments[0].created_at).toMatch(/^2026-11-01T10:00:00/);
    expect(body.counts).toEqual({ pending: 2, published: 1, refused: 0 });

    // published newest first, and the page filter
    const fourth = await post(a, ana.token, 'fourth');
    a.advance(1000);
    await a.json(`/comments/${fourth}/publish`, { method: 'POST' });
    const pub = await a.json('/comments?status=published');
    expect(pub.body.comments.map((c: { id: number }) => c.id)).toEqual([fourth, second]);
    const onPage = await a.json('/comments?status=published&path=/other');
    expect(onPage.body.comments.map((c: { id: number }) => c.id)).toEqual([second]);
    expect(onPage.body.counts).toEqual({ pending: 0, published: 1, refused: 0 });
  });

  it('refuses an unknown site, status or invalid path with 400', async () => {
    const a = withApi();
    expect((await a.call('/comments?site=nope')).status).toBe(400);
    expect((await a.call('/comments?status=deleted')).status).toBe(400);
    expect((await a.call('/comments?path=http://x')).status).toBe(400);
  });
});

describe('moderation actions', () => {
  it('publishes with the publication date and readers see it', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org', 'alt-web', 'Ana');
    const id = await post(a, token, 'hello');
    a.advance(5000);
    const { status, body } = await a.json(`/comments/${id}/publish`, { method: 'POST' });
    expect(status).toBe(200);
    expect(body.comment).toMatchObject({ id, status: 'published', email: 'ana@example.org' });
    expect(body.comment.published_at).toMatch(/^2026-11-01T10:00:05/);
    expect((await page(a)).comments).toMatchObject([{ id, status: 'published' }]);
  });

  it('refuses and unpublishes', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org');
    const id = await post(a, token);
    await a.json(`/comments/${id}/publish`, { method: 'POST' });
    const { body } = await a.json(`/comments/${id}/refuse`, { method: 'POST' });
    expect(body.comment).toMatchObject({ status: 'refused', published_at: null });
    expect((await page(a)).comments).toEqual([]);
  });

  it('marks sticky only published comments, and removes the mark', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org');
    const id = await post(a, token);
    expect((await a.json(`/comments/${id}/sticky`, { method: 'POST' })).status).toBe(409);
    await a.json(`/comments/${id}/publish`, { method: 'POST' });
    expect((await a.json(`/comments/${id}/sticky`, { method: 'POST' })).body.comment.sticky).toBe(true);
    expect((await a.json(`/comments/${id}/unsticky`, { method: 'POST' })).body.comment.sticky).toBe(false);
  });

  it('sets, changes and removes a reply; refuses a reply to a pending comment', async () => {
    const a = withApi();
    const { token } = a.reader('ana@example.org');
    const id = await post(a, token);
    expect((await a.json(`/comments/${id}/reply`, { method: 'PUT', json: { body: 'Thanks' } })).status).toBe(409);
    expect((await a.json(`/comments?status=pending`)).body.comments[0].reply).toBeNull();

    await a.json(`/comments/${id}/publish`, { method: 'POST' });
    const set = await a.json(`/comments/${id}/reply`, { method: 'PUT', json: { body: '  Thanks\r\nfor this  ' } });
    expect(set.body.comment.reply).toMatchObject({ body: 'Thanks\nfor this' });
    expect((await page(a)).comments[0]!.reply).toMatchObject({ body: 'Thanks\nfor this' });
    const changed = await a.json(`/comments/${id}/reply`, { method: 'PUT', json: { body: 'x'.repeat(2500) } });
    expect(changed.body.comment.reply.body).toHaveLength(2000);
    const removed = await a.json(`/comments/${id}/reply`, { method: 'PUT', json: { body: '' } });
    expect(removed.body.comment.reply).toBeNull();
    expect((await a.json(`/comments/${id}/reply`, { method: 'PUT', json: { body: 42 } })).status).toBe(400);
  });

  it('blocks a reader: pending comments refused, no more posts; unblocks', async () => {
    const a = withApi();
    const ana = a.reader('ana@example.org');
    const id = await post(a, ana.token);
    const { body } = await a.json(`/users/${ana.user.id}/block`, { method: 'POST' });
    expect(body.user).toEqual({ id: ana.user.id, blocked: true });
    expect((await a.json('/comments?status=refused')).body.comments).toMatchObject([{ id, blocked: true }]);
    const res = await a.api('/api/v1/sites/alt-web/comments', { method: 'POST', token: ana.token, json: { path: '/a/', body: 'again', lang: 'en' } });
    expect(res.status).toBe(403);
    expect((await a.json(`/users/${ana.user.id}/unblock`, { method: 'POST' })).body.user.blocked).toBe(false);
  });

  it('answers 404 for a comment or reader that does not exist', async () => {
    const a = withApi();
    expect((await a.call('/comments/999/publish', { method: 'POST' })).status).toBe(404);
    expect((await a.call('/comments/999/unsticky', { method: 'POST' })).status).toBe(404);
    expect((await a.call('/comments/999/reply', { method: 'PUT', json: { body: 'x' } })).status).toBe(404);
    expect((await a.call('/users/999/block', { method: 'POST' })).status).toBe(404);
  });
});

describe('rebuilds', () => {
  it('say they are off without the Coolify settings', async () => {
    const a = withApi();
    expect((await a.json('/rebuilds')).body).toEqual({ enabled: false });
    expect((await a.json('/rebuilds', { method: 'POST' })).body).toEqual({ enabled: false });
  });

  it('show the status per site and run the check now', async () => {
    const a = withApi({ rebuild: 'ok' });
    const before = await a.json('/rebuilds');
    expect(before.body).toEqual({ enabled: true, at: '03:30', timezone: 'Europe/Paris', sites: [{ id: 'alt-web', name: 'Alt Web', status: null }] });
    const run = await a.json('/rebuilds', { method: 'POST' });
    expect(run.body.sites[0].status).toMatchObject({ result: 'requested' });
    expect(a.deployed).toEqual(['altwebprod0001']);
    expect((await a.json('/rebuilds', { method: 'POST' })).body.sites[0].status).toMatchObject({ result: 'unchanged' });
  });
});
