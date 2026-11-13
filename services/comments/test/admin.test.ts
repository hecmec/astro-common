import { describe, expect, it } from 'vitest';
import { Notifier } from '../src/notify.ts';
import { ADMIN, ALT, BASE, page, post, setup } from './helpers.ts';

async function adminCookie(s: ReturnType<typeof setup>) {
  const login = await s.app.request('/admin/login');
  const flow = (await login.text()).match(/name="flow" value="([^"]+)"/)![1]!;
  const res = await s.form('/auth/dev', { flow, email: ADMIN });
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

async function admin(s: ReturnType<typeof setup>) {
  const cookie = await adminCookie(s);
  return {
    cookie,
    get: (url: string) => s.app.request(url, { headers: { cookie } }),
    act: (url: string, data: Record<string, string> = {}, origin = BASE) => s.form(url, data, { cookie, origin }),
  };
}

describe('moderation', () => {
  it('lists pending comments with author email and publishes them', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const ana = s.reader('ana@example.org', 'alt-web', 'Ana');
    const id = await post(s, ana.token, 'Please add a repair café');

    const queue = await (await a.get('/admin')).text();
    expect(queue).toContain('Please add a repair café');
    expect(queue).toContain('ana@example.org');
    expect(queue).toContain('https://www.alt-web.org/tag/vrac/');

    const res = await a.act(`/admin/comments/${id}/publish`);
    expect(res.status).toBe(302);
    expect((await page(s)).comments).toMatchObject([{ id, status: 'published', author: 'Ana' }]);
    expect(await (await a.get('/admin')).text()).not.toContain('Please add a repair café');
  });

  it('shows status tabs with counts that keep the site and page filters', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const { token } = s.reader('ana@example.org');
    const first = await post(s, token, 'first one');
    await post(s, token, 'second one');
    await a.act(`/admin/comments/${first}/publish`);

    const pending = await (await a.get('/admin')).text();
    expect(pending).toMatch(/aria-current="page">Pending <span class="count">1<\/span>/);
    expect(pending).toContain('Published <span class="count">1</span>');
    expect(pending).toContain('second one');
    expect(pending).not.toContain('first one');
    expect(pending).toContain('autocomplete="off"');

    const published = await (await a.get('/admin?status=published')).text();
    expect(published).toMatch(/aria-current="page">Published/);
    expect(published).toContain('first one');
    expect(published).not.toContain('second one');

    // filtered by site: tab links keep the filter, counts follow it
    const filtered = await (await a.get('/admin?status=published&site=simplygoodfood')).text();
    expect(filtered).toContain('href="/admin?status=pending&amp;site=simplygoodfood"');
    expect(filtered).toContain('No published comments for Simply Good Food.');
    expect(filtered).toContain('Pending <span class="count">0</span>');
    expect(filtered).toContain('Clear filters');
  });

  it('refuses, unpublishes and republishes', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const { token } = s.reader('ana@example.org');
    const id = await post(s, token);
    await a.act(`/admin/comments/${id}/refuse`);
    expect((await page(s)).comments).toHaveLength(0);
    await a.act(`/admin/comments/${id}/publish`);
    expect((await page(s)).comments).toHaveLength(1);
    await a.act(`/admin/comments/${id}/refuse`);
    expect((await page(s)).comments).toHaveLength(0);
    const history = await (await a.get('/admin?status=refused&site=alt-web&path=/tag/vrac/')).text();
    expect(history).toContain('A useful comment');
    expect(await (await a.get('/admin?status=refused&path=/other/')).text()).not.toContain('A useful comment');
  });

  it('adds, edits and removes a public reply', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const { token } = s.reader('ana@example.org');
    const id = await post(s, token);
    await a.act(`/admin/comments/${id}/publish`);
    await a.act(`/admin/comments/${id}/reply`, { body: 'Thanks, added!' });
    expect((await page(s)).comments[0]!.reply).toMatchObject({ body: 'Thanks, added!' });
    s.advance(8 * 24 * 60 * 60 * 1000);
    const exp = await (await s.api('/api/v1/sites/alt-web/export', { origin: null })).json();
    expect(exp.pages['/tag/vrac/'].comments[0].reply.body).toBe('Thanks, added!');
    await a.act(`/admin/comments/${id}/reply`, { body: 'Edited' });
    expect((await page(s)).comments[0]!.reply!.body).toBe('Edited');
    await a.act(`/admin/comments/${id}/reply`, { body: '' });
    expect((await page(s)).comments[0]!.reply).toBeNull();
  });

  it('blocks a reader: pending comments refused, no more posts or reactions', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const ana = s.reader('ana@example.org');
    const id = await post(s, ana.token);
    await a.act(`/admin/users/${ana.user.id}/block`);
    expect((await page(s, '/tag/vrac/', ana.token)).comments).toMatchObject([{ id, status: 'refused' }]);
    const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token: ana.token, json: { path: '/x/', body: 'again' } });
    expect(res.status).toBe(403);
    const r = await s.api('/api/v1/sites/alt-web/reactions', { method: 'PUT', token: ana.token, json: { path: '/x/', kind: 'useful', on: true } });
    expect(r.status).toBe(403);
    await a.act(`/admin/users/${ana.user.id}/unblock`);
    expect(await post(s, ana.token, 'back')).toBeGreaterThan(0);
  });

  it('refuses actions without the admin session or from another origin', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const { token } = s.reader('ana@example.org');
    const id = await post(s, token);
    expect((await s.form(`/admin/comments/${id}/publish`, {})).status).toBe(403);
    expect((await a.act(`/admin/comments/${id}/publish`, {}, ALT)).status).toBe(403);
    // a reader session is not an admin session
    const reader = s.reader(ADMIN, 'alt-web');
    expect((await s.app.request('/admin', { headers: { cookie: `bc_admin=${reader.token}` } })).status).toBe(302);
    expect((await page(s)).comments).toHaveLength(0);
  });

  it('escapes comment text in the admin page', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const { token } = s.reader('ana@example.org');
    await post(s, token, '<script>alert(1)</script>');
    const html = await (await a.get('/admin')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('notifications', () => {
  it('send one mail for comments posted close together, at most every 6 hours', async () => {
    const s = setup();
    const notifier = new Notifier({ db: s.db, mailer: s.mailer, sites: s.sites, adminEmail: ADMIN, baseUrl: BASE, now: s.now });
    const { token } = s.reader('ana@example.org');
    const HOUR = 60 * 60 * 1000;
    await post(s, token, 'first');
    expect(await notifier.tick()).toBe(false);
    s.advance(2 * HOUR);
    await post(s, token, 'second');
    s.advance(3 * HOUR);
    await post(s, token, 'third');
    expect(await notifier.tick()).toBe(false); // 5 hours after the first
    s.advance(1 * HOUR);
    expect(await notifier.tick()).toBe(true);
    expect(s.mailer.sent).toHaveLength(1);
    expect(s.mailer.sent[0]).toMatchObject({ to: ADMIN, subject: '3 new comments to moderate' });
    expect(s.mailer.sent[0]!.text).toContain('Alt Web /tag/vrac/');
    expect(s.mailer.sent[0]!.text).toContain(`${BASE}/admin`);
    expect(await notifier.tick()).toBe(false);

    await post(s, token, 'fourth');
    s.advance(5 * HOUR);
    expect(await notifier.tick()).toBe(false);
    s.advance(1 * HOUR);
    expect(await notifier.tick()).toBe(true);
    expect(s.mailer.sent[1]!.subject).toBe('1 new comment to moderate');
  });
});

describe('sticky comments and the per-page limit', () => {
  /** Inserts `n` published comments on a page, one minute apart; returns their ids, oldest first. */
  function seed(s: ReturnType<typeof setup>, n: number, path = '/busy/') {
    const { user } = s.reader('crowd@example.org');
    const insert = s.db.prepare(
      "INSERT INTO comments (site_id, path, lang, user_id, body, status, created_at, published_at) VALUES ('alt-web', ?, 'en', ?, ?, 'published', ?, ?)",
    );
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = s.now() + i * 60_000;
      ids.push(Number(insert.run(path, user.id, `comment ${i}`, t, t).lastInsertRowid));
    }
    s.advance(n * 60_000);
    return ids;
  }

  it('keeps the last 300 comments of a page, plus the sticky ones in their place', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const ids = seed(s, 310);
    expect((await page(s, '/busy/')).comments).toHaveLength(300);
    const first = (await page(s, '/busy/')).comments;
    expect(first[0]!.body).toBe('comment 309'); // most recent first
    expect(first.at(-1)!.body).toBe('comment 10');

    // Sticky: comment 3 (would be cut) and comment 200 (already among the last 300)
    expect((await a.act(`/admin/comments/${ids[3]}/sticky`)).status).toBe(302);
    await a.act(`/admin/comments/${ids[200]}/sticky`);
    const kept = (await page(s, '/busy/')).comments.map((c) => c.body);
    expect(kept).toHaveLength(301);
    expect(kept[0]).toBe('comment 309');
    expect(kept.slice(-2)).toEqual(['comment 10', 'comment 3']); // in its place, by date

    expect(await (await a.get('/admin?status=published&path=/busy/')).text()).toContain('Remove sticky');
    await a.act(`/admin/comments/${ids[3]}/unsticky`);
    expect((await page(s, '/busy/')).comments).toHaveLength(300);
  });

  it('applies the same limit to the export, per page', async () => {
    const s = setup({ devMode: true });
    const a = await admin(s);
    const ids = seed(s, 305);
    seed(s, 2, '/quiet/');
    await a.act(`/admin/comments/${ids[0]}/sticky`);
    s.advance(8 * 24 * 60 * 60 * 1000);
    const data = (await (await s.api('/api/v1/sites/alt-web/export', { origin: null })).json()) as {
      pages: Record<string, { comments: { body: string }[] }>;
    };
    const busy = data.pages['/busy/']!.comments.map((c) => c.body);
    expect(busy).toHaveLength(301);
    expect(busy.slice(-2)).toEqual(['comment 5', 'comment 0']);
    expect(data.pages['/quiet/']!.comments).toHaveLength(2);
  });

  it('keeps a page within the limit across baked and live comments', async () => {
    const s = setup();
    seed(s, 300);
    s.advance(8 * 24 * 60 * 60 * 1000);
    const cutoff = ((await (await s.api('/api/v1/sites/alt-web/export', { origin: null })).json()) as { cutoff: string }).cutoff;
    seed(s, 5); // newer than the cutoff
    expect((await page(s, '/busy/', undefined, cutoff)).comments.map((c) => c.body)).toEqual(['comment 4', 'comment 3', 'comment 2', 'comment 1', 'comment 0']);
    const all = (await page(s, '/busy/')).comments;
    expect(all).toHaveLength(300);
  });

  it('does not count a reader\'s own pending comments against the limit', async () => {
    const s = setup();
    seed(s, 300);
    const ana = s.reader('ana@example.org');
    await post(s, ana.token, 'mine, pending', '/busy/');
    const mine = (await page(s, '/busy/', ana.token)).comments;
    expect(mine).toHaveLength(301);
    expect(mine[0]).toMatchObject({ body: 'mine, pending', status: 'pending' });
  });
});
