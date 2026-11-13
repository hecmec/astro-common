import { describe, expect, it } from 'vitest';
import { ADMIN, ALT, BASE, SGF, page, setup } from './helpers.ts';

async function startFlow(s: ReturnType<typeof setup>, origin = ALT, site = 'alt-web') {
  const res = await s.api('/auth/flows', { method: 'POST', origin, json: { site, lang: 'fr' } });
  return { res, body: res.status === 201 ? ((await res.json()) as { flow: string; url: string }) : undefined };
}

async function poll(s: ReturnType<typeof setup>, flow: string, origin = ALT) {
  const res = await s.api(`/auth/flows/${flow}`, { origin });
  return (await res.json()) as { status: string; token?: string };
}

function linkToken(s: ReturnType<typeof setup>) {
  const mail = s.mailer.sent.at(-1)!;
  return new URL(mail.text.match(/https:\/\/\S+/)![0]).searchParams.get('token')!;
}

describe('sign-in flows', () => {
  it('can only be started from an allowed domain of the site', async () => {
    const s = setup();
    expect((await startFlow(s, 'https://evil.example')).res.status).toBe(403);
    expect((await startFlow(s, SGF, 'alt-web')).res.status).toBe(403);
    expect((await startFlow(s, ALT, 'nope')).res.status).toBe(403);
    const ok = await startFlow(s);
    expect(ok.res.status).toBe(201);
    expect(ok.res.headers.get('access-control-allow-origin')).toBe(ALT);
    expect(ok.body!.url).toBe(`${BASE}/auth/start?flow=${encodeURIComponent(ok.body!.flow)}`);
  });

  it('refuses preflights from unlisted domains', async () => {
    const s = setup();
    expect((await s.app.request('/auth/flows', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await s.app.request('/auth/flows', { method: 'OPTIONS', headers: { origin: ALT } })).status).toBe(204);
  });

  it('shows the popup in the language of the flow with the site name', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    const res = await s.app.request(`/auth/start?flow=${body!.flow}`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('Connectez-vous pour commenter sur Alt Web');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('rate-limits flows per IP', async () => {
    const s = setup();
    for (let i = 0; i < 20; i++) expect((await startFlow(s)).res.status).toBe(201);
    expect((await startFlow(s)).res.status).toBe(429);
  });
});

describe('email link', () => {
  it('signs in once, and hands the token over exactly once', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    const flow = body!.flow;
    const sent = await s.form('/auth/email', { flow, email: 'Ana@Example.org' });
    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain('ana@example.org');
    expect(s.mailer.sent).toHaveLength(1);
    expect(s.mailer.sent[0]!.subject).toBe('Votre lien de connexion pour Alt Web');
    expect(await poll(s, flow)).toEqual({ status: 'pending' });

    const token = linkToken(s);
    // GET only asks for confirmation (mail scanners must not consume the link)
    const confirm = await s.app.request(`/auth/email/verify?token=${token}`);
    expect(await confirm.text()).toContain('ana@example.org');
    expect(await poll(s, flow)).toEqual({ status: 'pending' });

    const done = await s.form('/auth/email/verify', { token });
    expect(done.status).toBe(200);
    expect(await done.text()).toContain('Vous êtes connecté');

    const first = await poll(s, flow);
    expect(first.status).toBe('done');
    expect(first.token).toBeTruthy();
    expect(await poll(s, flow)).toEqual({ status: 'expired' });

    const me = await s.api('/api/v1/sites/alt-web/me', { token: first.token });
    expect(await me.json()).toEqual({ me: { display_name: null } });
  });

  it('refuses a reused link', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    await s.form('/auth/email', { flow: body!.flow, email: 'ana@example.org' });
    const token = linkToken(s);
    expect((await s.form('/auth/email/verify', { token })).status).toBe(200);
    expect((await s.form('/auth/email/verify', { token })).status).toBe(410);
  });

  it('refuses a link older than 15 minutes', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    await s.form('/auth/email', { flow: body!.flow, email: 'ana@example.org' });
    const token = linkToken(s);
    s.advance(16 * 60 * 1000);
    expect((await s.app.request(`/auth/email/verify?token=${token}`)).status).toBe(410);
    expect((await s.form('/auth/email/verify', { token })).status).toBe(410);
  });

  it('refuses invalid emails and forms posted from elsewhere', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    expect((await s.form('/auth/email', { flow: body!.flow, email: 'not-an-email' })).status).toBe(400);
    expect((await s.form('/auth/email', { flow: body!.flow, email: 'a@b.org' }, { origin: ALT })).status).toBe(403);
    expect(s.mailer.sent).toHaveLength(0);
  });

  it('only delivers the token to the origin that started the flow', async () => {
    const s = setup();
    const { body } = await startFlow(s);
    await s.form('/auth/email', { flow: body!.flow, email: 'ana@example.org' });
    await s.form('/auth/email/verify', { token: linkToken(s) });
    expect(await poll(s, body!.flow, SGF)).toEqual({ status: 'expired' });
    expect((await poll(s, body!.flow, ALT)).status).toBe('done');
  });
});

describe('without SMTP', () => {
  it('hides and refuses the email sign-in', async () => {
    const s = setup({ emailSignIn: false });
    const { body } = await startFlow(s);
    const popup = await (await s.app.request(`/auth/start?flow=${body!.flow}`)).text();
    expect(popup).not.toContain('action="/auth/email"');
    expect(popup).toContain('pas encore disponible');
    expect((await s.form('/auth/email', { flow: body!.flow, email: 'ana@example.org' })).status).toBe(404);
    expect(s.mailer.sent).toHaveLength(0);
  });

  it('still offers Google', async () => {
    const s = setup({ emailSignIn: false, google: { sub: 'g1', email: 'ana@gmail.com', email_verified: true } });
    const { body } = await startFlow(s);
    const popup = await (await s.app.request(`/auth/start?flow=${body!.flow}`)).text();
    expect(popup).toContain('/auth/google?flow=');
    expect(popup).not.toContain('pas encore disponible');
  });
});

describe('Google', () => {
  async function googleSignIn(s: ReturnType<typeof setup>) {
    const { body } = await startFlow(s);
    const redirect = await s.app.request(`/auth/google?flow=${body!.flow}`);
    expect(redirect.status).toBe(302);
    const state = new URL(redirect.headers.get('location')!).searchParams.get('state')!;
    expect(state).not.toBe(body!.flow);
    const cb = await s.app.request(`/auth/google/callback?state=${state}&code=abc`);
    return { cb, flow: body!.flow };
  }

  it('signs in with a verified Google account', async () => {
    const s = setup({ google: { sub: 'g1', email: 'ana@gmail.com', email_verified: true } });
    const { cb, flow } = await googleSignIn(s);
    expect(cb.status).toBe(200);
    expect((await poll(s, flow)).status).toBe('done');
  });

  it('refuses an unverified Google email', async () => {
    const s = setup({ google: { sub: 'g1', email: 'ana@gmail.com', email_verified: false } });
    const { cb, flow } = await googleSignIn(s);
    expect(cb.status).toBe(403);
    expect(await cb.text()).toContain('lien par e-mail');
    expect(await poll(s, flow)).toEqual({ status: 'pending' });
  });

  it('reports a failed exchange', async () => {
    const s = setup({ google: new Error('boom') });
    expect((await googleSignIn(s)).cb.status).toBe(502);
  });
});

describe('sessions', () => {
  it('are bound to their site', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org', 'alt-web');
    expect(await page(s, '/x/', token)).toMatchObject({ me: { display_name: 'ana' } });
    const other = await s.api('/api/v1/sites/simplygoodfood/me', { origin: SGF, token });
    expect(await other.json()).toEqual({ me: null });
  });

  it('end with sign-out', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    expect((await s.api('/api/v1/sites/alt-web/logout', { method: 'POST', token })).status).toBe(204);
    expect((await page(s, '/x/', token)).me).toBeNull();
  });

  it('expire after 90 days', async () => {
    const s = setup();
    const { token } = s.reader('ana@example.org');
    s.advance(91 * 24 * 60 * 60 * 1000);
    expect((await page(s, '/x/', token)).me).toBeNull();
  });
});

describe('admin sign-in', () => {
  it('admits only the configured admin', async () => {
    const s = setup({ devMode: true });
    const login = await s.app.request('/admin/login');
    const flow = (await login.text()).match(/name="flow" value="([^"]+)"/)![1]!;
    const refused = await s.form('/auth/dev', { flow, email: 'someone@example.org' });
    expect(refused.status).toBe(403);

    const login2 = await s.app.request('/admin/login');
    const flow2 = (await login2.text()).match(/name="flow" value="([^"]+)"/)![1]!;
    const ok = await s.form('/auth/dev', { flow: flow2, email: ADMIN });
    expect(ok.status).toBe(302);
    const cookie = ok.headers.get('set-cookie')!;
    expect(cookie).toMatch(/bc_admin=.*HttpOnly/i);
    const admin = await s.app.request('/admin', { headers: { cookie: cookie.split(';')[0]! } });
    expect(admin.status).toBe(200);
  });

  it('redirects to the login without a session, and offers no dev sign-in outside dev mode', async () => {
    const s = setup();
    expect((await s.app.request('/admin')).headers.get('location')).toBe('/admin/login');
    expect((await s.form('/auth/dev', { flow: 'x', email: ADMIN })).status).toBe(404);
  });
});
