import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { html, raw } from 'hono/html';
import type { Deps } from '../context.ts';
import { layout } from '../pages.ts';
import { pageUrl as sitePageUrl } from '../sites.ts';
import {
  ADMIN_SITE,
  MAX_COMMENTS_PER_PAGE,
  type Status,
  type User,
  countByStatus,
  createFlow,
  deleteSession,
  getComment,
  listComments,
  sessionUser,
  setBlocked,
  setReply,
  setSticky,
  setStatus,
} from '../store.ts';
import { iso, normalizePath } from '../util.ts';
import { ADMIN_COOKIE } from './auth.ts';

type Env = { Variables: { admin: User } };

const STATUSES: Status[] = ['pending', 'published', 'refused'];

export function adminRoutes(deps: Deps): Hono<Env> {
  const { config, sites, db, now } = deps;
  const app = new Hono<Env>();

  const pageUrl = (siteId: string, path: string) => sitePageUrl(sites, siteId, path);

  app.get('/login', (c) => {
    const flow = createFlow(db, { kind: 'admin', siteId: ADMIN_SITE, origin: config.baseUrl, lang: 'en' }, now());
    return c.html(
      layout({
        title: 'Comments admin',
        body: html`<h1>Comments admin</h1>
          ${deps.google ? html`<p><a class="btn" href="/auth/google?flow=${flow}">Sign in with Google</a></p>` : html`<p class="notice">Google sign-in is not configured.</p>`}
          ${
            config.devMode
              ? html`<form method="post" action="/auth/dev" class="stack">
                  <input type="hidden" name="flow" value="${flow}">
                  <input name="email" type="email" required value="${config.adminEmail}" aria-label="Admin email">
                  <button class="btn danger" type="submit">Dev sign-in</button>
                </form>`
              : ''
          }`,
      }),
    );
  });

  // Everything below needs the admin session.
  app.use('*', async (c, next) => {
    const user = sessionUser(db, getCookie(c, ADMIN_COOKIE), ADMIN_SITE, now());
    if (!user || !config.adminEmail || user.email !== config.adminEmail) {
      if (c.req.method === 'GET') return c.redirect('/admin/login');
      return c.text('Forbidden', 403);
    }
    // Forms only from the admin page itself.
    if (c.req.method !== 'GET' && c.req.header('origin') !== config.baseUrl) return c.text('Forbidden', 403);
    c.set('admin', user);
    await next();
  });

  const back = (c: Context) => {
    const ref = c.req.header('referer');
    return c.redirect(ref?.startsWith(`${config.baseUrl}/admin`) ? ref : '/admin');
  };

  const rebuildBox = () => {
    const r = deps.rebuilder;
    if (!r) return html`<section class="card muted"><strong>Site rebuilds</strong>: off (COOLIFY_API_URL / COOLIFY_DEPLOY_TOKEN not set).</section>`;
    return html`<section class="card">
      <div class="row" style="justify-content: space-between">
        <strong>Site rebuilds</strong>
        <form method="post" action="/admin/rebuild"><button class="btn small secondary">Rebuild changed sites now</button></form>
      </div>
      <p class="muted">Every night at ${config.rebuildAt} (Europe/Paris), sites whose baked comments or reactions changed are rebuilt.</p>
      <ul>
        ${r.configuredSites().map((s) => {
          const st = r.status(s.id);
          const when = st ? st.checked_at.slice(0, 16).replace('T', ' ') + ' UTC' : 'never checked';
          const what = !st ? '' : st.result === 'requested' ? 'rebuild requested' : st.result === 'unchanged' ? 'unchanged, no rebuild' : `failed: ${st.error}`;
          return html`<li>${s.name}: ${when}${what ? html` · ${what}` : ''}</li>`;
        })}
      </ul>
    </section>`;
  };

  app.get('/', (c) => {
    const status = (STATUSES.find((s) => s === c.req.query('status')) ?? 'pending') as Status;
    const siteId = sites.has(c.req.query('site') ?? '') ? c.req.query('site') : undefined;
    const path = normalizePath(c.req.query('path')) ?? undefined;
    const rows = listComments(db, { status, siteId, path });
    const counts = countByStatus(db, { siteId, path });
    const pendingAll = countByStatus(db).pending;
    const scope = [siteId ? sites.get(siteId)!.name : 'all sites', path].filter(Boolean).join(', ');
    // Tabs keep the site and page filters; the filter form keeps the status.
    const tabUrl = (s: Status) => {
      const q = new URLSearchParams({ status: s });
      if (siteId) q.set('site', siteId);
      if (path) q.set('path', path);
      return `/admin?${q}`;
    };
    return c.html(
      layout({
        title: `Comments admin (${pendingAll} pending)`,
        wide: true,
        body: html`
          <div class="row" style="justify-content: space-between">
            <h1>Comments</h1>
            <form method="post" action="/admin/logout"><button class="btn small secondary">Sign out</button></form>
          </div>
          ${
            config.consoleUrl
              ? html`<p class="notice" data-console-notice>Moderation has moved to the admin console: <a href="${`${config.consoleUrl}/comments`}">open the Comments page</a>. This page stays as a fallback for now.</p>`
              : ''
          }
          <nav class="tabs" aria-label="Status">
            ${STATUSES.map(
              (s) => html`<a href="${tabUrl(s)}" class="tab" ${s === status ? raw('aria-current="page"') : ''}>${s[0]!.toUpperCase() + s.slice(1)} <span class="count">${counts[s]}</span></a>`,
            )}
          </nav>
          <form class="filters" method="get" action="/admin">
            <input type="hidden" name="status" value="${status}">
            <select name="site" aria-label="Site">
              <option value="">All sites</option>
              ${[...sites.values()].map((s) => html`<option value="${s.id}" ${s.id === siteId ? 'selected' : ''}>${s.name}</option>`)}
            </select>
            <input name="path" type="text" placeholder="/page/path/ (optional)" value="${path ?? ''}" aria-label="Page path" autocomplete="off">
            <button class="btn small">Apply</button>
            ${siteId || path ? html`<a href="${`/admin?status=${status}`}" class="muted">Clear filters</a>` : ''}
          </form>
          ${rows.length === 0 ? html`<p class="notice">No ${status} comments for ${scope}.</p>` : ''}
          ${rows.map(
            (r) => html`<article class="card">
              <div class="row muted">
                <span class="badge">${sites.get(r.site_id)?.name ?? r.site_id}</span>
                <a href="${pageUrl(r.site_id, r.path)}" target="_blank" rel="noopener">${r.path}</a>
                <span>${r.lang}</span>
                <span>${iso(r.created_at)?.slice(0, 16).replace('T', ' ')}</span>
                <span>${r.display_name ?? 'Former reader'}${r.email ? html` &lt;${r.email}&gt;` : ''}</span>
                ${r.blocked_at ? html`<span class="badge">blocked</span>` : ''}
                ${r.sticky ? html`<span class="badge">sticky</span>` : ''}
              </div>
              <p class="body">${r.body}</p>
              <div class="row">
                ${r.status !== 'published' ? html`<form method="post" action="/admin/comments/${r.id}/publish"><button class="btn small">Publish</button></form>` : ''}
                ${
                  r.status === 'published'
                    ? html`<form method="post" action="/admin/comments/${r.id}/${r.sticky ? 'unsticky' : 'sticky'}"><button class="btn small secondary" title="A sticky comment keeps its place and is never cut when the page has more than ${MAX_COMMENTS_PER_PAGE} comments">${r.sticky ? 'Remove sticky' : 'Make sticky'}</button></form>`
                    : ''
                }
                ${r.status !== 'refused' ? html`<form method="post" action="/admin/comments/${r.id}/refuse"><button class="btn small danger">${r.status === 'published' ? 'Unpublish' : 'Refuse'}</button></form>` : ''}
                ${
                  r.user_id
                    ? html`<form method="post" action="/admin/users/${r.user_id}/${r.blocked_at ? 'unblock' : 'block'}"><button class="btn small secondary">${r.blocked_at ? 'Unblock reader' : 'Block reader'}</button></form>`
                    : ''
                }
              </div>
              ${
                r.status === 'published'
                  ? html`<form method="post" action="/admin/comments/${r.id}/reply" class="stack" style="margin-top: .75rem">
                      <label for="reply-${r.id}">Public reply${r.reply_body ? '' : ' (none yet)'}</label>
                      <textarea id="reply-${r.id}" name="body" rows="2" maxlength="2000">${r.reply_body ?? ''}</textarea>
                      <button class="btn small secondary">Save reply</button>
                    </form>`
                  : ''
              }
            </article>`,
          )}
          ${rebuildBox()}`,
      }),
    );
  });

  app.post('/comments/:id/:action{publish|refuse}', (c) => {
    const id = Number(c.req.param('id'));
    const action = c.req.param('action');
    if (!getComment(db, id)) return c.text('Not found', 404);
    setStatus(db, id, action === 'publish' ? 'published' : 'refused', now());
    return back(c);
  });

  app.post('/comments/:id/:action{sticky|unsticky}', (c) => {
    const id = Number(c.req.param('id'));
    if (!setSticky(db, id, c.req.param('action') === 'sticky')) return c.text('Not found', 404);
    return back(c);
  });

  app.post('/comments/:id/reply', async (c) => {
    const id = Number(c.req.param('id'));
    const comment = getComment(db, id);
    if (!comment || comment.status !== 'published') return c.text('Not found', 404);
    const form = await c.req.parseBody();
    const body = String(form.body ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 2000);
    setReply(db, id, body || null, now());
    return back(c);
  });

  app.post('/users/:id/:action{block|unblock}', (c) => {
    setBlocked(db, Number(c.req.param('id')), c.req.param('action') === 'block', now());
    return back(c);
  });

  app.post('/rebuild', async (c) => {
    if (deps.rebuilder) await deps.rebuilder.runAll();
    return back(c);
  });

  app.post('/logout', (c) => {
    const token = getCookie(c, ADMIN_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(c, ADMIN_COOKIE, { path: '/' });
    return c.redirect('/admin/login');
  });

  return app;
}
