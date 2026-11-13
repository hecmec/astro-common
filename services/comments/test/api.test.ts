import { describe, expect, it } from 'vitest';
import { setStatus } from '../src/store.ts';
import { ALT, SGF, page, post, setup } from './helpers.ts';

const DAY = 24 * 60 * 60 * 1000;

describe('allowed domains', () => {
  it('refuses unlisted domains and the domains of other sites', async () => {
    const s = setup();
    expect((await s.api('/api/v1/sites/alt-web/page?path=/x/', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await s.api('/api/v1/sites/alt-web/page?path=/x/', { origin: SGF })).status).toBe(403);
    expect((await s.api('/api/v1/sites/alt-web/page?path=/x/', { origin: 'https://alt-web-staging.babelcoach.com' })).status).toBe(200);
    expect((await s.api('/api/v1/sites/nope/page?path=/x/')).status).toBe(404);
  });

  it('answers preflights for allowed origins only', async () => {
    const s = setup();
    const ok = await s.api('/api/v1/sites/alt-web/comments', { method: 'OPTIONS' });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-headers')).toContain('authorization');
    expect((await s.api('/api/v1/sites/alt-web/comments', { method: 'OPTIONS', origin: SGF })).status).toBe(403);
  });

  it('requires an Origin on changes', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', origin: null, token, json: { path: '/x/', body: 'hi' } });
    expect(res.status).toBe(403);
  });
});

describe('comments', () => {
  it('are pending and visible only to their author until published', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    const bob = s.reader('bob@example.org');
    const id = await post(s, ana.token);
    expect(s.newComments()).toBe(1);
    expect((await page(s, '/tag/vrac/', ana.token)).comments).toMatchObject([{ id, status: 'pending', mine: true, author: 'ana' }]);
    expect((await page(s, '/tag/vrac/', bob.token)).comments).toEqual([]);
    expect((await page(s)).comments).toEqual([]);

    setStatus(s.db, id, 'published', s.now());
    expect((await page(s)).comments).toMatchObject([{ id, status: 'published', mine: false, body: 'A useful comment' }]);
  });

  it('shows a refused comment to its author only', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    const id = await post(s, ana.token);
    setStatus(s.db, id, 'refused', s.now());
    expect((await page(s, '/tag/vrac/', ana.token)).comments).toMatchObject([{ id, status: 'refused' }]);
    expect((await page(s, '/tag/vrac/', s.reader('bob@example.org').token)).comments).toEqual([]);
  });

  it('never exposes email addresses', async () => {
    const s = setup();
    const ana = s.reader('ana.secret@example.org', 'alt-web', 'Ana');
    setStatus(s.db, await post(s, ana.token), 'published', s.now());
    s.advance(8 * DAY);
    for (const url of ['/api/v1/sites/alt-web/page?path=/tag/vrac/', '/api/v1/sites/alt-web/export']) {
      const text = await (await s.api(url, { token: ana.token })).text();
      expect(text).toContain('Ana');
      expect(text).not.toContain('secret');
    }
  });

  it('belong to one page per URL: query strings ignored, languages apart', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    const id = await post(s, ana.token, 'hello', '/tag/vrac?utm=x');
    setStatus(s.db, id, 'published', s.now());
    expect((await page(s, '/tag/vrac/')).comments).toHaveLength(1);
    expect((await page(s, '/fr/tag/vrac/')).comments).toHaveLength(0);
  });

  it('need a signed-in reader with a display name', async () => {
    const s = setup();
    const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', json: { path: '/x/', body: 'hi' } });
    expect(res.status).toBe(401);
    const nameless = s.reader('nameless@example.org', 'alt-web', null);
    const res2 = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token: nameless.token, json: { path: '/x/', body: 'hi' } });
    expect(res2.status).toBe(409);
    expect((await s.api('/api/v1/sites/alt-web/me', { method: 'PUT', token: nameless.token, json: { display_name: 'x' } })).status).toBe(400);
    expect((await s.api('/api/v1/sites/alt-web/me', { method: 'PUT', token: nameless.token, json: { display_name: '  Léa   M. ' } })).status).toBe(200);
    expect(await post(s, nameless.token)).toBeGreaterThan(0);
    expect((await page(s, '/tag/vrac/', nameless.token)).comments[0]!.author).toBe('Léa M.');
  });

  it('must be 1 to 500 characters', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    for (const body of ['', '   ', 'x'.repeat(501)]) {
      const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token, json: { path: '/x/', body } });
      expect(res.status).toBe(400);
    }
    expect(await post(s, token, 'x'.repeat(500))).toBeGreaterThan(0);
  });

  it('are limited to 10 per hour', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    for (let i = 0; i < 10; i++) await post(s, token, `comment ${i}`);
    const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token, json: { path: '/x/', body: 'one more' } });
    expect(res.status).toBe(429);
    s.advance(61 * 60 * 1000);
    expect(await post(s, token, 'later')).toBeGreaterThan(0);
  });

  it('are limited to 30 pending', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    for (let i = 0; i < 30; i++) {
      await post(s, token, `comment ${i}`);
      if (i % 10 === 9) s.advance(61 * 60 * 1000);
    }
    const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token, json: { path: '/x/', body: 'one more' } });
    expect(res.status).toBe(429);
  });

  it('can be deleted by their author only', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    const bob = s.reader('bob@example.org');
    const id = await post(s, ana.token);
    setStatus(s.db, id, 'published', s.now());
    expect((await s.api(`/api/v1/sites/alt-web/comments/${id}`, { method: 'DELETE', token: bob.token })).status).toBe(404);
    expect((await s.api(`/api/v1/sites/alt-web/comments/${id}`, { method: 'DELETE', token: ana.token })).status).toBe(204);
    expect((await page(s)).comments).toEqual([]);
  });

  it('can be limited to those published after a cutoff', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    const old = await post(s, token, 'old');
    setStatus(s.db, old, 'published', s.now());
    const cutoff = new Date(s.now()).toISOString();
    s.advance(DAY);
    const fresh = await post(s, token, 'fresh');
    setStatus(s.db, fresh, 'published', s.now());
    expect((await page(s, '/tag/vrac/', undefined, cutoff)).comments.map((c) => c.body)).toEqual(['fresh']);
    expect((await page(s)).comments.map((c) => c.body)).toEqual(['fresh', 'old']); // most recent first
  });
});

describe('reactions', () => {
  it('toggle per reader and kind, with public counts', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    const bob = s.reader('bob@example.org');
    const react = (token: string, kind: string, on: boolean) =>
      s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', token, json: { path: '/x/', kind, on, lang: 'fr' } });

    expect((await react(ana.token, 'useful', true)).status).toBe(200);
    await react(ana.token, 'useful', true); // twice counts once
    await react(bob.token, 'useful', true);
    const res = await react(bob.token, 'tried', true);
    expect((await res.json()).reactions).toEqual([
      { id: 'useful', icon: '👍', label: 'Utile', count: 2, mine: true },
      { id: 'tried', icon: '✅', label: 'Je l’utilise', count: 1, mine: true },
    ]);
    await react(ana.token, 'useful', false);
    const anon = await page(s, '/x/');
    expect(anon.reactions.map((r) => [r.id, r.count, r.mine])).toEqual([
      ['useful', 1, false],
      ['tried', 1, false],
    ]);
  });

  it('refuse unknown kinds and anonymous readers', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    expect((await s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', token, json: { path: '/x/', kind: 'love', on: true } })).status).toBe(400);
    expect((await s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', json: { path: '/x/', kind: 'useful', on: true } })).status).toBe(401);
  });
});

describe('account deletion', () => {
  it('can delete the comments', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    setStatus(s.db, await post(s, ana.token), 'published', s.now());
    await s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', token: ana.token, json: { path: '/tag/vrac/', kind: 'useful', on: true } });
    expect((await s.api('/api/v1/sites/alt-web/me?comments=delete', { method: 'DELETE', token: ana.token })).status).toBe(204);
    const p = await page(s);
    expect(p.comments).toEqual([]);
    expect(p.reactions[0]!.count).toBe(0);
    expect(s.db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
    expect((await page(s, '/tag/vrac/', ana.token)).me).toBeNull();
  });

  it('can keep published comments as "Former reader"', async () => {
    const s = setup();
    const ana = s.reader('ana@example.org');
    setStatus(s.db, await post(s, ana.token, 'kept'), 'published', s.now());
    await post(s, ana.token, 'pending one');
    await s.api('/api/v1/sites/alt-web/me?comments=keep', { method: 'DELETE', token: ana.token });
    expect((await page(s)).comments).toMatchObject([{ body: 'kept', author: null }]);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'").get()).toEqual({ n: 0 });
  });
});

describe('export', () => {
  it('contains published comments older than the delay, grouped by page', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    const old = await post(s, token, 'old one', '/a/');
    setStatus(s.db, old, 'published', s.now());
    const refused = await post(s, token, 'refused one', '/a/');
    setStatus(s.db, refused, 'published', s.now());
    const deleted = await post(s, token, 'deleted one', '/b/');
    setStatus(s.db, deleted, 'published', s.now());
    s.advance(5 * DAY);
    const young = await post(s, token, 'young one', '/a/');
    setStatus(s.db, young, 'published', s.now());
    s.advance(3 * DAY); // old: 8 days, young: 3 days
    setStatus(s.db, refused, 'refused', s.now());
    await s.api(`/api/v1/sites/alt-web/comments/${deleted}`, { method: 'DELETE', token });
    await s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', token, json: { path: '/c/', kind: 'useful', on: true } });

    const res = await s.api('/api/v1/sites/alt-web/export', { origin: null });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=600');
    const data = (await res.json()) as { cutoff: string; pages: Record<string, { comments: { body: string }[]; reactions: Record<string, number> }> };
    expect(data.cutoff).toBe(new Date(s.now() - 7 * DAY).toISOString());
    expect(Object.keys(data.pages).sort()).toEqual(['/a/', '/c/']);
    expect(data.pages['/a/']!.comments.map((c) => c.body)).toEqual(['old one']);
    expect(data.pages['/c/']).toEqual({ comments: [], reactions: { useful: 1 } });
  });

  it('uses the delay of each site and refuses foreign origins', async () => {
    const s = setup();
    const res = await s.api('/api/v1/sites/simplygoodfood/export', { origin: null });
    expect(((await res.json()) as { cutoff: string }).cutoff).toBe(new Date(s.now() - 3 * DAY).toISOString());
    expect((await s.api('/api/v1/sites/simplygoodfood/export', { origin: ALT })).status).toBe(403);
  });
});
