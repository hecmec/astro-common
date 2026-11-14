import { type Context, Hono } from 'hono';
import { type Deps, bearer } from '../context.ts';
import { buildExport } from '../export.ts';
import { type Lang, type Site, pickLang } from '../sites.ts';
import {
  type CommentRow,
  type User,
  allReactionCounts,
  countUserComments,
  deleteAccount,
  deleteOwnComment,
  deleteSession,
  exportComments,
  getComment,
  insertComment,
  pageComments,
  reactionCounts,
  sessionUser,
  setDisplayName,
  setReaction,
  userReactions,
} from '../store.ts';
import { DAY, MINUTE, iso, normalizePath } from '../util.ts';

type Env = { Variables: { site: Site; user?: User } };

export const MAX_BODY = 500;
export const MAX_PER_HOUR = 10;
export const MAX_PENDING = 30;

/** Public shape of a comment: never an email address. */
function publicComment(row: CommentRow, userId: number | null) {
  const mine = userId != null && row.user_id === userId;
  return {
    id: row.id,
    author: row.display_name ?? null, // null: "Former reader"
    body: row.body,
    status: row.status,
    created_at: iso(row.created_at),
    published_at: iso(row.published_at),
    mine,
    reply: row.reply_body ? { body: row.reply_body, created_at: iso(row.reply_created_at) } : null,
  };
}

function reactionsFor(deps: Deps, site: Site, path: string, lang: Lang, user?: User) {
  const counts = reactionCounts(deps.db, site.id, path);
  const mine = user ? userReactions(deps.db, site.id, path, user.id) : new Set<string>();
  return site.reactions.map((r) => ({ id: r.id, icon: r.icon, label: r.label[lang], count: counts.get(r.id) ?? 0, mine: mine.has(r.id) }));
}

function me(user: User | undefined) {
  return user ? { display_name: user.display_name } : null;
}

export function apiRoutes(deps: Deps): Hono<Env> {
  const { db, sites, now } = deps;
  const app = new Hono<Env>();

  // Allowed domains: the Origin must belong to the site in the path.
  app.use('/sites/:site/*', async (c, next) => {
    const site = sites.get(c.req.param('site')!);
    if (!site) return c.json({ error: 'unknown_site' }, 404);
    const origin = c.req.header('origin');
    const isExport = c.req.path.endsWith('/export');
    if (origin) {
      // The refusal is readable cross-origin (no data in it), so the widget can hide itself.
      if (!site.origins.has(origin)) return c.json({ error: 'origin_not_allowed' }, 403, { 'access-control-allow-origin': origin, vary: 'Origin' });
      c.header('access-control-allow-origin', origin);
      c.header('vary', 'Origin');
    } else if (c.req.method !== 'GET' && !isExport) {
      return c.json({ error: 'origin_required' }, 403);
    }
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204, {
        'access-control-allow-methods': 'GET, POST, PUT, DELETE',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '86400',
      });
    }
    c.set('site', site);
    const user = sessionUser(db, bearer(c), site.id, now());
    if (user) c.set('user', user);
    await next();
  });

  const requireUser = (c: Context<Env>) => {
    const user = c.get('user');
    if (!user) return { error: c.json({ error: 'not_signed_in' }, 401) };
    return { user };
  };

  app.get('/sites/:site/page', (c) => {
    const site = c.get('site');
    const user = c.get('user');
    const path = normalizePath(c.req.query('path'));
    if (!path) return c.json({ error: 'invalid_path' }, 400);
    const lang = pickLang(c.req.query('lang'), site);
    const afterRaw = c.req.query('after');
    const after = afterRaw ? Date.parse(afterRaw) : NaN;
    const rows = pageComments(db, site.id, path, Number.isNaN(after) ? null : after, user?.id ?? null);
    c.header('cache-control', 'no-store');
    return c.json({
      site: { id: site.id, name: site.name },
      path,
      comments: rows.map((r) => publicComment(r, user?.id ?? null)),
      reactions: reactionsFor(deps, site, path, lang, user),
      me: me(user),
    });
  });

  app.post('/sites/:site/comments', async (c) => {
    const { user, error } = requireUser(c);
    if (error) return error;
    const site = c.get('site');
    const input = (await c.req.json().catch(() => ({}))) as { path?: unknown; body?: unknown; lang?: unknown };
    const path = normalizePath(input.path);
    const body = typeof input.body === 'string' ? input.body.replace(/\r\n?/g, '\n').trim() : '';
    if (!path) return c.json({ error: 'invalid_path' }, 400);
    if (!user.display_name) return c.json({ error: 'display_name_required' }, 409);
    if (user.blocked_at) return c.json({ error: 'not_allowed' }, 403);
    if (body.length < 1 || body.length > MAX_BODY) return c.json({ error: 'invalid_length', max: MAX_BODY }, 400);
    const counts = countUserComments(db, user.id, now() - 60 * MINUTE);
    if (counts.recent >= MAX_PER_HOUR || counts.pending >= MAX_PENDING) return c.json({ error: 'too_many' }, 429);
    const id = insertComment(db, { siteId: site.id, path, lang: pickLang(input.lang, site), userId: user.id, body }, now());
    deps.onNewComment?.();
    return c.json({ comment: publicComment(getComment(db, id)!, user.id) }, 201);
  });

  app.delete('/sites/:site/comments/:id', (c) => {
    const { user, error } = requireUser(c);
    if (error) return error;
    const ok = deleteOwnComment(db, Number(c.req.param('id')), user.id, c.get('site').id);
    return ok ? c.body(null, 204) : c.json({ error: 'not_found' }, 404);
  });

  app.put('/sites/:site/reactions', async (c) => {
    const { user, error } = requireUser(c);
    if (error) return error;
    const site = c.get('site');
    const input = (await c.req.json().catch(() => ({}))) as { path?: unknown; kind?: unknown; on?: unknown; lang?: unknown };
    const path = normalizePath(input.path);
    if (!path) return c.json({ error: 'invalid_path' }, 400);
    if (user.blocked_at) return c.json({ error: 'not_allowed' }, 403);
    if (!site.reactions.some((r) => r.id === input.kind)) return c.json({ error: 'unknown_reaction' }, 400);
    setReaction(db, { siteId: site.id, path, userId: user.id, kind: input.kind as string, on: input.on === true }, now());
    return c.json({ reactions: reactionsFor(deps, site, path, pickLang(input.lang, site), user) });
  });

  app.get('/sites/:site/me', (c) => {
    c.header('cache-control', 'no-store');
    return c.json({ me: me(c.get('user')) });
  });

  app.put('/sites/:site/me', async (c) => {
    const { user, error } = requireUser(c);
    if (error) return error;
    const input = (await c.req.json().catch(() => ({}))) as { display_name?: unknown };
    const name = typeof input.display_name === 'string' ? input.display_name.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2 || name.length > 40) return c.json({ error: 'invalid_display_name' }, 400);
    setDisplayName(db, user.id, name);
    return c.json({ me: { display_name: name } });
  });

  app.delete('/sites/:site/me', (c) => {
    const { user, error } = requireUser(c);
    if (error) return error;
    deleteAccount(db, user.id, c.req.query('comments') === 'keep');
    return c.body(null, 204);
  });

  app.post('/sites/:site/logout', (c) => {
    const token = bearer(c);
    if (token) deleteSession(db, token);
    return c.body(null, 204);
  });

  /** Published comments older than the site's delay, for static site builds. */
  app.get('/sites/:site/export', (c) => {
    c.header('cache-control', 'public, max-age=600');
    return c.json(buildExport(db, c.get('site'), now()));
  });

  return app;
}
