import { type Context, Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { type Deps, type Limits, clientIp } from '../context.ts';
import { t } from '../i18n.ts';
import { confirmLinkPage, messagePage, signInPage } from '../pages.ts';
import { isAllowedOrigin, pickLang } from '../sites.ts';
import {
  type Flow,
  SESSION_TTL,
  completeFlow,
  createFlow,
  createLoginLink,
  findOrCreateUser,
  flowByOAuthState,
  getFlow,
  getFlowByHash,
  getLoginLink,
  setFlowOAuth,
  takeFlowToken,
  useLoginLink,
} from '../store.ts';
import { pkceChallenge } from '@babelcoach/google-auth';
import { EMAIL_RE, randomToken } from '../util.ts';

export const ADMIN_COOKIE = 'bc_admin';

export function authRoutes(deps: Deps, limits: Limits): Hono {
  const { config, sites, db, now } = deps;
  const app = new Hono();
  const redirectUri = `${config.baseUrl}/auth/google/callback`;

  const sameOrigin = (origin: string | undefined) => origin === config.baseUrl;

  const cors = (origin: string) => ({
    'access-control-allow-origin': origin,
    vary: 'Origin',
  });

  // ---- endpoints called by the widget (cross-origin) ----------------------

  app.options('/flows/*', (c) => {
    const origin = c.req.header('origin');
    if (!origin || !isAllowedOrigin(sites, origin)) return c.body(null, 403);
    return c.body(null, 204, {
      ...cors(origin),
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
  });
  app.options('/flows', (c) => {
    const origin = c.req.header('origin');
    if (!origin || !isAllowedOrigin(sites, origin)) return c.body(null, 403);
    return c.body(null, 204, {
      ...cors(origin),
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
  });

  /** The widget starts a sign-in: only from an allowed origin of the site. */
  app.post('/flows', async (c) => {
    const origin = c.req.header('origin');
    const body = (await c.req.json().catch(() => ({}))) as { site?: string; lang?: string };
    const site = body.site ? sites.get(body.site) : undefined;
    if (!origin || !site || !site.origins.has(origin)) return c.json({ error: 'origin_not_allowed' }, 403);
    if (!limits.flows.hit(await clientIp(c, config.trustProxy))) return c.json({ error: 'too_many' }, 429, cors(origin));
    const lang = pickLang(body.lang, site);
    const id = createFlow(db, { kind: 'reader', siteId: site.id, origin, lang }, now());
    return c.json({ flow: id, url: `${config.baseUrl}/auth/start?flow=${encodeURIComponent(id)}` }, 201, cors(origin));
  });

  /** The widget polls its flow; the session token is handed over once. */
  app.get('/flows/:id', (c) => {
    const origin = c.req.header('origin');
    const flow = getFlow(db, c.req.param('id'), now());
    if (!origin || !isAllowedOrigin(sites, origin)) return c.json({ error: 'origin_not_allowed' }, 403);
    if (!flow || flow.origin !== origin) return c.json({ status: 'expired' }, 200, cors(origin));
    if (!flow.completed_at) return c.json({ status: 'pending' }, 200, cors(origin));
    const token = takeFlowToken(db, flow);
    return c.json(token ? { status: 'done', token } : { status: 'expired' }, 200, cors(origin));
  });

  // ---- popup pages (first-party on the service) --------------------------

  app.get('/start', (c) => {
    const flowId = c.req.query('flow');
    const flow = getFlow(db, flowId, now());
    if (!flow || flow.completed_at || flow.kind !== 'reader') {
      const lang = pickLang(c.req.query('lang'));
      return c.html(messagePage(lang, t(lang, 'flowExpired'), t(lang, 'flowExpired'), { error: true }), 410);
    }
    const site = sites.get(flow.site_id);
    if (!site || !site.origins.has(flow.origin)) {
      return c.html(messagePage(flow.lang, t(flow.lang, 'unknownOrigin'), t(flow.lang, 'unknownOrigin'), { error: true }), 403);
    }
    return c.html(signInPage({ lang: flow.lang, siteName: site.name, flow: flowId!, google: !!deps.google, email: config.emailSignIn, dev: config.devMode }));
  });

  /** Lets the popup close itself once signed in (no token here). */
  app.get('/popup-status', (c) => {
    const flow = getFlow(db, c.req.query('flow'), now());
    return c.json({ done: !!flow?.completed_at, expired: !flow });
  });

  app.get('/google', (c) => {
    const flowId = c.req.query('flow');
    const flow = getFlow(db, flowId, now());
    if (!deps.google || !flow || flow.completed_at) {
      const lang = flow?.lang ?? 'en';
      return c.html(messagePage(lang, t(lang, 'flowExpired'), t(lang, 'flowExpired'), { error: true }), 410);
    }
    const state = randomToken();
    const verifier = randomToken(48);
    setFlowOAuth(db, flow.id_hash, state, verifier);
    return c.redirect(deps.google.authorizationUrl({ state, codeChallenge: pkceChallenge(verifier), redirectUri }));
  });

  app.get('/google/callback', async (c) => {
    const flow = flowByOAuthState(db, c.req.query('state'), now());
    const code = c.req.query('code');
    if (!deps.google || !flow || !flow.code_verifier) {
      return c.html(messagePage('en', t('en', 'flowExpired'), t('en', 'flowExpired'), { error: true }), 410);
    }
    const lang = flow.lang;
    if (!code) return c.html(messagePage(lang, t(lang, 'googleError'), t(lang, 'googleError'), { error: true }), 400);
    let profile;
    try {
      profile = await deps.google.exchange({ code, codeVerifier: flow.code_verifier, redirectUri });
    } catch (err) {
      console.error('Google sign-in failed:', err);
      return c.html(messagePage(lang, t(lang, 'googleError'), t(lang, 'googleError'), { error: true }), 502);
    }
    if (!profile.email_verified) {
      return c.html(messagePage(lang, t(lang, 'googleUnverified'), t(lang, 'googleUnverified'), { error: true }), 403);
    }
    return finish(c, flow, profile.email, profile.sub);
  });

  app.post('/email', async (c) => {
    if (!config.emailSignIn) return c.notFound();
    if (!sameOrigin(c.req.header('origin'))) return c.text('Forbidden', 403);
    const form = await c.req.parseBody();
    const flowId = String(form.flow ?? '');
    const email = String(form.email ?? '').trim().toLowerCase();
    const flow = getFlow(db, flowId, now());
    if (!flow || flow.completed_at || flow.kind !== 'reader') {
      return c.html(messagePage('en', t('en', 'flowExpired'), t('en', 'flowExpired'), { error: true }), 410);
    }
    const site = sites.get(flow.site_id)!;
    const page = (extra: { error?: string; sent?: string }, status: 200 | 400 | 429 = 200) =>
      c.html(signInPage({ lang: flow.lang, siteName: site.name, flow: flowId, google: !!deps.google, email: config.emailSignIn, dev: config.devMode, ...extra }), status);
    if (!EMAIL_RE.test(email) || email.length > 320) return page({ error: t(flow.lang, 'invalidEmail') }, 400);
    const ip = await clientIp(c, config.trustProxy);
    if (!limits.flows.hit(`email-ip:${ip}`) || !limits.emails.hit(email)) return page({ error: t(flow.lang, 'tooMany') }, 429);
    const token = createLoginLink(db, flow, email, now());
    const link = `${config.baseUrl}/auth/email/verify?token=${encodeURIComponent(token)}`;
    await deps.mailer.send({
      to: email,
      subject: t(flow.lang, 'mailSubject', { site: site.name }),
      text: t(flow.lang, 'mailText', { site: site.name, link }),
    });
    return page({ sent: email });
  });

  // GET only shows a confirmation button: mail scanners that open links must not consume them.
  app.get('/email/verify', (c) => {
    const token = c.req.query('token');
    const link = getLoginLink(db, token, now());
    const flow = link && getFlowByHash(db, link.flow_id_hash, now());
    if (!link || !flow || flow.completed_at) {
      const lang = flow?.lang ?? 'en';
      return c.html(messagePage(lang, t(lang, 'linkInvalid'), t(lang, 'linkInvalid'), { error: true }), 410);
    }
    const site = sites.get(flow.site_id);
    return c.html(confirmLinkPage({ lang: flow.lang, siteName: site?.name ?? config.baseUrl, email: link.email, token: token! }));
  });

  app.post('/email/verify', async (c) => {
    if (!sameOrigin(c.req.header('origin'))) return c.text('Forbidden', 403);
    const form = await c.req.parseBody();
    const link = getLoginLink(db, String(form.token ?? ''), now());
    const flow = link && getFlowByHash(db, link.flow_id_hash, now());
    if (!link || !flow || flow.completed_at || !useLoginLink(db, link, now())) {
      const lang = flow?.lang ?? 'en';
      return c.html(messagePage(lang, t(lang, 'linkInvalid'), t(lang, 'linkInvalid'), { error: true }), 410);
    }
    return finish(c, flow, link.email);
  });

  /** Development only: sign in with any email, no check. */
  app.post('/dev', async (c) => {
    if (!config.devMode || config.production) return c.notFound();
    if (!sameOrigin(c.req.header('origin'))) return c.text('Forbidden', 403);
    const form = await c.req.parseBody();
    const flow = getFlow(db, String(form.flow ?? ''), now());
    const email = String(form.email ?? '').trim().toLowerCase();
    if (!flow || flow.completed_at || !EMAIL_RE.test(email)) return c.text('Bad request', 400);
    return finish(c, flow, email);
  });

  function finish(c: Context, flow: Flow, email: string, googleSub?: string) {
    const lang = flow.lang;
    if (flow.kind === 'admin') {
      if (!config.adminEmail || email !== config.adminEmail) {
        return c.html(messagePage(lang, 'Forbidden', 'This account is not the admin account.', { error: true }), 403);
      }
      const user = findOrCreateUser(db, email, now(), googleSub);
      const token = completeFlow(db, flow, user, now());
      setCookie(c, ADMIN_COOKIE, token, {
        httpOnly: true,
        secure: config.baseUrl.startsWith('https://'),
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_TTL / 1000,
      });
      return c.redirect('/admin');
    }
    const user = findOrCreateUser(db, email, now(), googleSub);
    completeFlow(db, flow, user, now());
    return c.html(messagePage(lang, t(lang, 'signedIn'), t(lang, 'signedIn'), { close: true }));
  }

  return app;
}
