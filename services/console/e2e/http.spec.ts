import { expect, request, test } from '@playwright/test';
import { A, B, C, FAKES, postForm, resetFakes, signedIn, umamiCalls } from './helpers.ts';

test.beforeEach(resetFakes);

test.describe('admin-console', () => {
  test('health check answers without sign-in, whatever the sources', async () => {
    const r = await request.newContext();
    for (const base of [A, B, C]) {
      const res = await r.get(`${base}/healthz`);
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    }
  });

  test('not signed in: sent to sign-in, then to the page asked for', async () => {
    const r = await request.newContext({ baseURL: A, extraHTTPHeaders: { origin: A } });
    const res = await r.get('/visits?range=90', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers().location).toBe('/login?next=%2Fvisits%3Frange%3D90');
    const login = await r.post('/auth/dev', { form: { email: 'admin@example.org', next: '/visits?range=90' }, maxRedirects: 0 });
    expect(login.headers().location).toBe('/visits?range=90');
    expect((await r.get('/visits?range=90')).status()).toBe(200);
  });

  test('another account is refused, named, and gets no session', async () => {
    const r = await request.newContext({ baseURL: A, extraHTTPHeaders: { origin: A } });
    const res = await r.post('/auth/dev', { form: { email: 'stranger@example.org' }, maxRedirects: 0 });
    expect(res.headers()['set-cookie']).toBeUndefined();
    const page = await r.get(res.headers().location!);
    expect(page.status()).toBe(403);
    expect(await page.text()).toContain('Access refused for stranger@example.org');
    expect((await r.get('/comments', { maxRedirects: 0 })).status()).toBe(302);
  });

  test('sign out ends the session', async () => {
    const r = await signedIn();
    expect((await r.get('/comments', { maxRedirects: 0 })).status()).toBe(200);
    const out = await postForm(r, '/logout', {});
    expect(out.headers().location).toBe('/login');
    expect((await r.get('/comments', { maxRedirects: 0 })).status()).toBe(302);
  });

  test('a form from another site is refused and changes nothing', async () => {
    const r = await signedIn();
    const res = await r.post('/comments/1/publish', { form: { back: '' }, headers: { origin: 'https://evil.test' }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
    expect(await (await r.get('/comments')).text()).toContain('Is the battery easy to replace?');
  });

  test('the menu shows the pending count on every page, none at zero, none when the service is down', async () => {
    const r = await signedIn();
    for (const path of ['/comments', '/visits']) {
      const html = await (await r.get(path)).text();
      expect(html).toMatch(/data-menu-item="comments"[\s\S]*?data-pending[^>]*>\s*4\s*</);
    }
    for (const id of [1, 2, 3, 4]) await postForm(r, `/comments/${id}/refuse`, { back: '' });
    expect(await (await r.get('/visits')).text()).not.toContain('data-pending');

    const down = await signedIn(B);
    const visits = await down.get('/visits');
    expect(visits.status()).toBe(200);
    const html = await visits.text();
    expect(html).toContain('data-menu-item="comments"');
    expect(html).not.toContain('data-pending');
  });

  test('pages carry security headers', async () => {
    const r = await signedIn();
    const res = await r.get('/comments');
    expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['cache-control']).toBe('no-store');
  });
});

test.describe('comment-moderation', () => {
  test('the queue lists pending comments of all sites, oldest first, with tab counts', async () => {
    const r = await signedIn();
    const html = await (await r.get('/comments')).text();
    const order = ['Is the battery easy to replace?', 'Lovely soup', 'Please add a repair café', 'Super ressource'].map((t) => html.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('anna@example.org');
    expect(html).toContain('href="https://www.alt-web.org/alternatives/fairphone/"');
    expect(html).toMatch(/data-tab="pending"[\s\S]*?data-count[^>]*>4</);
    expect(html).toMatch(/data-tab="published"[\s\S]*?data-count[^>]*>1</);
    expect(html).not.toContain('Great phone');
  });

  test('a link from a site admin opens the page filtered on that site', async () => {
    const r = await signedIn();
    const html = await (await r.get('/comments?site=alt-web')).text();
    expect(html).toContain('Is the battery easy to replace?');
    expect(html).not.toContain('Lovely soup');
    expect(html).toMatch(/<option value="alt-web" selected/);
    expect(html).toMatch(/data-tab="published"[^>]*href="\/comments\?status=published&amp;site=alt-web"|href="\/comments\?status=published&amp;site=alt-web"[^>]*data-tab="published"/);
  });

  test('filtering by page lists every comment on it with its status', async () => {
    const r = await signedIn();
    const html = await (await r.get('/comments?status=published&path=/alternatives/fairphone/')).text();
    expect(html).toContain('Great phone, two years now.');
    expect(html).toContain('Thanks Eli!');
  });

  test('publishing comes back to the same tab and filters, without the comment', async () => {
    const r = await signedIn();
    const res = await postForm(r, '/comments/2/publish', { back: 'status=pending&site=simplygoodfood' });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe('/comments?status=pending&site=simplygoodfood&notice=published');
    const html = await (await r.get(res.headers().location!)).text();
    expect(html).not.toContain('Lovely soup');
    expect(html).toContain('Comment published.');
    expect(html).toContain('No pending comments for Simply Good Food.');
  });

  test('sticky, reply and block go through the admin API', async () => {
    const r = await signedIn();
    await postForm(r, '/comments/5/sticky', { back: 'status=published' });
    let html = await (await r.get('/comments?status=published')).text();
    expect(html).toContain('Remove sticky');
    await postForm(r, '/comments/5/reply', { back: 'status=published', body: 'Glad it lasts.' });
    html = await (await r.get('/comments?status=published')).text();
    expect(html).toContain('>Glad it lasts.</textarea>');
    const refused = await postForm(r, '/comments/1/sticky', { back: '' });
    expect(refused.headers().location).toContain('notice=not_published');
    await postForm(r, '/users/3/block', { back: '' });
    html = await (await r.get('/comments')).text();
    expect(html).not.toContain('Please add a repair café');
    expect(await (await r.get('/comments?status=refused')).text()).toMatch(/Please add a repair café[\s\S]*?Unblock reader|Unblock reader[\s\S]*?Please add a repair café/);
  });

  test('when the comments service is down the page says so, not "no comments"', async () => {
    const r = await signedIn(B);
    const res = await r.get('/comments');
    expect(res.status()).toBe(503);
    const html = await res.text();
    expect(html).toContain('The comments service is unavailable');
    expect(html).not.toContain('No pending comments');
    const action = await postForm(r, '/comments/1/publish', { back: '' });
    expect(action.headers().location).toContain('notice=unavailable');
  });
});

test.describe('site-rebuild', () => {
  test('the Comments page shows the rebuild status and runs the check', async () => {
    const r = await signedIn();
    let html = await (await r.get('/comments')).text();
    expect(html).toContain('Rebuild changed sites now');
    expect(html).toContain('Alt Web: never checked');
    const res = await postForm(r, '/rebuilds', { back: 'status=pending' });
    expect(res.headers().location).toBe('/comments?status=pending&notice=rebuilt');
    html = await (await r.get(res.headers().location!)).text();
    expect(html).toContain('rebuild requested');
  });
});

test.describe('console-visits', () => {
  test('opens on 30 days of visitors for the four sites', async () => {
    const r = await signedIn();
    const html = await (await r.get('/visits')).text();
    expect(html.match(/<polyline/g)).toHaveLength(4);
    expect(html.match(/data-point="alt-web"/g)).toHaveLength(30);
    expect(html).toMatch(/data-range="30"[^>]*aria-current="page"|aria-current="page"[^>]*data-range="30"/);
    expect(html).toContain('Daily visitors per site, last 30 days');
  });

  test('90 days of pageviews: 90 points per site, kept in the address', async () => {
    const r = await signedIn();
    const html = await (await r.get('/visits?range=90&metric=pageviews')).text();
    expect(html.match(/data-point="simplygoodfood"/g)).toHaveLength(90);
    expect(html).toContain('pageviews</title>');
    expect(html).toContain('href="/visits?range=7&amp;metric=pageviews"');
  });

  test('totals per site serve as legend, and the note explains visits', async () => {
    const r = await signedIn();
    const html = await (await r.get('/visits?range=7')).text();
    for (const id of ['anglais-gratuit', 'simplygoodfood', 'alt-web', 'bonetgratuit']) expect(html).toMatch(new RegExp(`data-total="${id}"[\\s\\S]*?\\d`));
    expect(html).toContain('the total over a period counts returning people again');
    expect(html).toContain('Show as table');
  });

  test('a reload within 5 minutes does not ask Umami again', async () => {
    const r = await signedIn();
    await r.get('/visits?range=7&metric=visitors');
    const before = await umamiCalls();
    await r.get('/visits?range=7&metric=visitors');
    await r.get('/visits?range=7&metric=pageviews');
    expect((await umamiCalls()).pageviews).toBe(before.pageviews);
  });

  test('one site failing: the others are drawn and the missing one is named', async () => {
    const r = await signedIn(B);
    const html = await (await r.get('/visits?range=7')).text();
    expect(html.match(/<polyline/g)).toHaveLength(3);
    expect(html).toContain('No statistics for Bon et gratuit right now');
    expect(html).toMatch(/data-total="bonetgratuit"[\s\S]*?unavailable/);
  });

  test('Umami down: a message and no chart', async () => {
    const r = await signedIn(C);
    const res = await r.get('/visits');
    expect(res.status()).toBe(503);
    const html = await res.text();
    expect(html).toContain('Visit statistics are unavailable');
    expect(html).not.toContain('<polyline');
  });

  test('the page source has figures but no Umami credential or token', async () => {
    const r = await signedIn();
    const html = await (await r.get('/visits')).text();
    expect(html).toContain('visitors</title>');
    for (const secret of ['e2e-umami-pw', 'umami-session-token-not-for-pages', 'e2e-console-token', FAKES]) expect(html).not.toContain(secret);
  });
});

test.describe('console-search', () => {
  const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const latest = addDays(new Date().toISOString().slice(0, 10), -3);

  test('opens on 30 days of clicks for the four sites, ending on the latest published day', async () => {
    const r = await signedIn();
    const res = await r.get('/search');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.match(/<polyline/g)).toHaveLength(4);
    expect(html.match(/data-point="alt-web"/g)).toHaveLength(30);
    expect(html).toContain(`data-latest-day="${latest}"`);
    expect(html).toContain('two to three days late');
    expect(html).toMatch(/data-range="30"[^>]*aria-current="page"|aria-current="page"[^>]*data-range="30"/);
  });

  test('7 days of impressions, kept in the address, with totals as legend', async () => {
    const r = await signedIn();
    const html = await (await r.get('/search?range=7&metric=impressions')).text();
    expect(html.match(/data-point="simplygoodfood"/g)).toHaveLength(7);
    expect(html).toContain('impressions</title>');
    for (const id of ['anglais-gratuit', 'simplygoodfood', 'alt-web', 'bonetgratuit']) expect(html).toMatch(new RegExp(`data-total="${id}"[\\s\\S]*?\\d`));
    expect(html).toContain('href="/search?range=90&amp;metric=impressions"');
  });

  test('top searches of all sites, most clicks first, each with its site', async () => {
    const r = await signedIn();
    const html = await (await r.get('/search')).text();
    const rows = [...html.matchAll(/data-top-row="([a-z-]+)"/g)].map((m) => m[1]);
    expect(new Set(rows)).toEqual(new Set(['anglais-gratuit', 'simplygoodfood', 'alt-web', 'bonetgratuit']));
    expect(rows).toHaveLength(8);
    expect(html).toContain('>anglais-gratuit free<');
    expect(html).toContain('Google leaves out rare searches');
  });

  test('top searches of one site; the chart keeps the four sites', async () => {
    const r = await signedIn();
    const html = await (await r.get('/search?site=alt-web')).text();
    const rows = [...html.matchAll(/data-top-row="([a-z-]+)"/g)].map((m) => m[1]);
    expect(new Set(rows)).toEqual(new Set(['alt-web']));
    expect(html.match(/<polyline/g)).toHaveLength(4);
    expect(html).toMatch(/data-site-filter="alt-web"[^>]*aria-current="page"|aria-current="page"[^>]*data-site-filter="alt-web"/);
  });

  test('a reload within the hour does not ask Search Console again', async () => {
    const r = await signedIn();
    await r.get('/search?range=7');
    const before = await umamiCalls();
    await r.get('/search?range=7');
    await r.get('/search?range=7&metric=impressions');
    expect((await umamiCalls()).gscQuery).toBe(before.gscQuery);
  });

  test('a property not shared with the console: three lines and a notice naming it', async () => {
    const r = await signedIn(B);
    const html = await (await r.get('/search?range=7')).text();
    expect(html.match(/<polyline/g)).toHaveLength(3);
    expect(html).toContain('No Search Console data for Bon et gratuit right now');
    expect(html).toMatch(/data-total="bonetgratuit"[\s\S]*?unavailable/);
  });

  test('Search Console down: a message and no chart', async () => {
    const r = await signedIn(C);
    const res = await r.get('/search');
    expect(res.status()).toBe(503);
    const html = await res.text();
    expect(html).toContain('Search statistics are unavailable');
    expect(html).not.toContain('<polyline');
  });

  test('the page source has figures but no key, token or service-account email', async () => {
    const r = await signedIn();
    const html = await (await r.get('/search')).text();
    expect(html).toContain('clicks</title>');
    for (const secret of ['PRIVATE KEY', 'gsc-access-token-not-for-pages', 'iam.gserviceaccount.com', FAKES]) expect(html).not.toContain(secret);
  });

  test('the menu offers Search after Visits, current on the Search page', async () => {
    const r = await signedIn();
    const comments = await (await r.get('/comments')).text();
    expect(comments.indexOf('data-menu-item="visits"')).toBeLessThan(comments.indexOf('data-menu-item="search"'));
    const search = await (await r.get('/search')).text();
    expect(search).toMatch(/aria-current="page"[^>]*data-menu-item="search"|data-menu-item="search"[^>]*aria-current="page"/);
  });
});
