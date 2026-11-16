import { createHash, timingSafeEqual } from 'node:crypto';
import { type Context, Hono } from 'hono';
import { type Deps, bearer } from '../context.ts';
import { REBUILD_TIMEZONE } from '../rebuild.ts';
import { pageUrl } from '../sites.ts';
import {
  type CommentRow,
  type Status,
  countByStatus,
  getComment,
  getUser,
  listComments,
  setBlocked,
  setReply,
  setSticky,
  setStatus,
} from '../store.ts';
import { iso, normalizePath } from '../util.ts';

const STATUSES: Status[] = ['pending', 'published', 'refused'];
const MAX_REPLY = 2000;

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time comparison of a presented token with the configured one. */
export function tokenMatches(presented: string | undefined, expected: string): boolean {
  if (!presented) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

/**
 * Admin API for the console (spec comment-admin-api): server to server, authenticated by
 * the shared CONSOLE_TOKEN, no CORS. Off (404) when the token is not configured.
 */
export function adminApiRoutes(deps: Deps): Hono {
  const { config, sites, db, now } = deps;
  const app = new Hono();

  app.use('*', async (c, next) => {
    if (!config.consoleToken) return c.json({ error: 'not_found' }, 404);
    if (!tokenMatches(bearer(c), config.consoleToken)) return c.json({ error: 'unauthorized' }, 401);
    await next();
  });

  type Row = CommentRow & { email?: string | null; blocked_at?: number | null };
  const commentJson = (r: Row) => ({
    id: r.id,
    site: r.site_id,
    path: r.path,
    url: pageUrl(sites, r.site_id, r.path),
    lang: r.lang,
    status: r.status,
    created_at: iso(r.created_at),
    published_at: iso(r.published_at),
    author: r.display_name,
    email: r.email ?? null,
    user_id: r.user_id,
    blocked: r.blocked_at != null,
    sticky: !!r.sticky,
    body: r.body,
    reply: r.reply_body ? { body: r.reply_body, created_at: iso(r.reply_created_at) } : null,
  });

  /** The comment as the list shows it (with the author's email and block state). */
  const fullComment = (id: number) => {
    const base = getComment(db, id);
    if (!base) return undefined;
    const user = base.user_id ? getUser(db, base.user_id) : undefined;
    return commentJson({ ...base, email: user?.email ?? null, blocked_at: user?.blocked_at ?? null });
  };

  const notFound = (c: Context) => c.json({ error: 'not_found' }, 404);

  app.get('/summary', (c) => {
    const perSite = Object.fromEntries([...sites.values()].map((s) => [s.id, { name: s.name, ...countByStatus(db, { siteId: s.id }) }]));
    return c.json({ sites: perSite, all: countByStatus(db) });
  });

  app.get('/comments', (c) => {
    const statusParam = c.req.query('status');
    const status = statusParam ? STATUSES.find((s) => s === statusParam) : 'pending';
    if (!status) return c.json({ error: 'invalid_status' }, 400);
    const siteParam = c.req.query('site');
    if (siteParam && !sites.has(siteParam)) return c.json({ error: 'unknown_site' }, 400);
    const pathParam = c.req.query('path');
    const path = pathParam ? normalizePath(pathParam) : undefined;
    if (path === null) return c.json({ error: 'invalid_path' }, 400);
    const filter = { siteId: siteParam || undefined, path };
    return c.json({
      comments: listComments(db, { status, ...filter }).map(commentJson),
      counts: countByStatus(db, filter),
    });
  });

  app.post('/comments/:id/:action{publish|refuse}', (c) => {
    const id = Number(c.req.param('id'));
    if (!getComment(db, id)) return notFound(c);
    setStatus(db, id, c.req.param('action') === 'publish' ? 'published' : 'refused', now());
    return c.json({ comment: fullComment(id) });
  });

  app.post('/comments/:id/:action{sticky|unsticky}', (c) => {
    const id = Number(c.req.param('id'));
    const comment = getComment(db, id);
    if (!comment) return notFound(c);
    const sticky = c.req.param('action') === 'sticky';
    if (sticky && comment.status !== 'published') return c.json({ error: 'not_published' }, 409);
    setSticky(db, id, sticky);
    return c.json({ comment: fullComment(id) });
  });

  app.put('/comments/:id/reply', async (c) => {
    const id = Number(c.req.param('id'));
    const comment = getComment(db, id);
    if (!comment) return notFound(c);
    let input: { body?: unknown };
    try {
      input = (await c.req.json()) as { body?: unknown };
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }
    if (input.body != null && typeof input.body !== 'string') return c.json({ error: 'invalid_body' }, 400);
    const body = (input.body ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_REPLY);
    if (body && comment.status !== 'published') return c.json({ error: 'not_published' }, 409);
    setReply(db, id, body || null, now());
    return c.json({ comment: fullComment(id) });
  });

  app.post('/users/:id/:action{block|unblock}', (c) => {
    const id = Number(c.req.param('id'));
    if (!getUser(db, id)) return notFound(c);
    setBlocked(db, id, c.req.param('action') === 'block', now());
    return c.json({ user: { id, blocked: getUser(db, id)!.blocked_at != null } });
  });

  const rebuildsJson = () => {
    const r = deps.rebuilder;
    if (!r) return { enabled: false as const };
    return {
      enabled: true as const,
      at: config.rebuildAt,
      timezone: REBUILD_TIMEZONE,
      sites: r.configuredSites().map((s) => ({ id: s.id, name: s.name, status: r.status(s.id) ?? null })),
    };
  };

  app.get('/rebuilds', (c) => c.json(rebuildsJson()));

  app.post('/rebuilds', async (c) => {
    if (deps.rebuilder) await deps.rebuilder.runAll();
    return c.json(rebuildsJson());
  });

  app.all('*', notFound);

  return app;
}
