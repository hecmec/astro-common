/**
 * Fake upstreams for the console's browser tests: the comments service's admin API and
 * Umami v3, on one port. Path prefixes make a console instance see failures:
 *   /down/...      every request answers 503 (comments service or Umami down)
 *   /fail-bg/...   Umami fails for bon-et-gratuit only
 * POST /__reset restores the comments; GET /__stats gives the Umami request counts.
 */
import { createServer } from 'node:http';
import { lastDays, parisDay } from '../src/lib/dates.ts';

export const FAKES_PORT = 4389;
export const TOKEN = 'e2e-console-token-0123456789abcdefghij';
const UMAMI_TOKEN = 'umami-session-token-not-for-pages';
const BG_UMAMI = 'e1100d32-1ea8-418b-81b7-f38a9612b5f5';
const SITE_NAMES: Record<string, string> = {
  'anglais-gratuit': 'Anglais gratuit',
  simplygoodfood: 'Simply Good Food',
  'alt-web': 'Alt Web',
  bonetgratuit: 'Bon et gratuit',
};
const DOMAINS: Record<string, string> = {
  'anglais-gratuit': 'www.anglais-gratuit.org',
  simplygoodfood: 'www.simplygoodfood.eu',
  'alt-web': 'www.alt-web.org',
  bonetgratuit: 'www.bon-et-gratuit.fr',
};

type Status = 'pending' | 'published' | 'refused';
interface Comment {
  id: number;
  site: string;
  path: string;
  lang: string;
  status: Status;
  created_at: string;
  published_at: string | null;
  author: string | null;
  email: string | null;
  user_id: number | null;
  sticky: boolean;
  body: string;
  reply: { body: string; created_at: string } | null;
}

const blocked = new Set<number>();
let comments: Comment[] = [];
let rebuildRuns = 0;
const umamiCalls = { login: 0, pageviews: 0 };

function seed() {
  const c = (id: number, site: string, path: string, status: Status, created: string, body: string, author: string, user: number, extra: Partial<Comment> = {}): Comment => ({
    id,
    site,
    path,
    lang: site === 'anglais-gratuit' || site === 'bonetgratuit' ? 'fr' : 'en',
    status,
    created_at: created,
    published_at: status === 'published' ? created : null,
    author,
    email: `${author.toLowerCase()}@example.org`,
    user_id: user,
    sticky: false,
    body,
    reply: null,
    ...extra,
  });
  comments = [
    c(1, 'alt-web', '/alternatives/fairphone/', 'pending', '2026-11-14T09:00:00.000Z', 'Is the battery easy to replace?', 'Anna', 1),
    c(2, 'simplygoodfood', '/recipes/soup/', 'pending', '2026-11-14T10:00:00.000Z', 'Lovely soup, I added ginger.', 'Ben', 2),
    c(3, 'alt-web', '/tag/vrac/', 'pending', '2026-11-15T08:00:00.000Z', 'Please add a repair café.', 'Chloe', 3),
    c(4, 'anglais-gratuit', '/ressources/bbc/', 'pending', '2026-11-15T12:00:00.000Z', 'Super ressource.', 'Dana', 4),
    c(5, 'alt-web', '/alternatives/fairphone/', 'published', '2026-11-10T09:00:00.000Z', 'Great phone, two years now.', 'Eli', 5, {
      reply: { body: 'Thanks Eli!', created_at: '2026-11-11T09:00:00.000Z' },
    }),
    c(6, 'bonetgratuit', '/ressources/x/', 'refused', '2026-11-09T09:00:00.000Z', 'Buy cheap pills here', 'Spam', 6),
  ];
  blocked.clear();
  rebuildRuns = 0;
}
seed();

const counts = (list: Comment[]) => ({
  pending: list.filter((c) => c.status === 'pending').length,
  published: list.filter((c) => c.status === 'published').length,
  refused: list.filter((c) => c.status === 'refused').length,
});
const view = (c: Comment) => ({ ...c, url: `https://${DOMAINS[c.site]}${c.path}`, blocked: c.user_id !== null && blocked.has(c.user_id) });

function adminApi(method: string, path: string, query: URLSearchParams, body: unknown): [number, unknown] {
  if (path === '/summary') {
    return [200, { sites: Object.fromEntries(Object.keys(SITE_NAMES).map((id) => [id, { name: SITE_NAMES[id], ...counts(comments.filter((c) => c.site === id)) }])), all: counts(comments) }];
  }
  if (path === '/comments' && method === 'GET') {
    const status = (query.get('status') ?? 'pending') as Status;
    const site = query.get('site');
    if (site && !SITE_NAMES[site]) return [400, { error: 'unknown_site' }];
    const p = query.get('path');
    const scoped = comments.filter((c) => (!site || c.site === site) && (!p || c.path === p));
    const list = scoped.filter((c) => c.status === status).sort((a, b) => (status === 'pending' ? 1 : -1) * a.created_at.localeCompare(b.created_at));
    return [200, { comments: list.map(view), counts: counts(scoped) }];
  }
  let m = /^\/comments\/(\d+)\/(publish|refuse|sticky|unsticky)$/.exec(path);
  if (m && method === 'POST') {
    const c = comments.find((x) => x.id === Number(m![1]));
    if (!c) return [404, { error: 'not_found' }];
    if (m[2] === 'sticky' && c.status !== 'published') return [409, { error: 'not_published' }];
    if (m[2] === 'publish') Object.assign(c, { status: 'published', published_at: new Date().toISOString() });
    if (m[2] === 'refuse') Object.assign(c, { status: 'refused', published_at: null });
    if (m[2] === 'sticky' || m[2] === 'unsticky') c.sticky = m[2] === 'sticky';
    return [200, { comment: view(c) }];
  }
  m = /^\/comments\/(\d+)\/reply$/.exec(path);
  if (m && method === 'PUT') {
    const c = comments.find((x) => x.id === Number(m![1]));
    if (!c) return [404, { error: 'not_found' }];
    const text = String((body as { body?: unknown })?.body ?? '').trim();
    if (text && c.status !== 'published') return [409, { error: 'not_published' }];
    c.reply = text ? { body: text, created_at: new Date().toISOString() } : null;
    return [200, { comment: view(c) }];
  }
  m = /^\/users\/(\d+)\/(block|unblock)$/.exec(path);
  if (m && method === 'POST') {
    const id = Number(m[1]);
    if (!comments.some((c) => c.user_id === id)) return [404, { error: 'not_found' }];
    if (m[2] === 'block') {
      blocked.add(id);
      for (const c of comments) if (c.user_id === id && c.status === 'pending') c.status = 'refused';
    } else blocked.delete(id);
    return [200, { user: { id, blocked: blocked.has(id) } }];
  }
  if (path === '/rebuilds') {
    if (method === 'POST') rebuildRuns++;
    const status = rebuildRuns ? { checked_at: '2026-11-16T10:00:00.000Z', result: 'requested' } : null;
    return [200, { enabled: true, at: '03:30', timezone: 'Europe/Paris', sites: [{ id: 'alt-web', name: 'Alt Web', status }, { id: 'simplygoodfood', name: 'Simply Good Food', status: null }] }];
  }
  return [404, { error: 'not_found' }];
}

/** Deterministic daily figures per website: different levels so the lines separate. */
function pageviews(websiteId: string, startAt: number, endAt: number) {
  const level = Number.parseInt(websiteId.slice(0, 2), 16) + 5;
  const first = parisDay(startAt);
  const days = lastDays(endAt, 120).filter((d) => d >= first);
  const day = (d: string) => `${d} 00:00:00`; // as stats.babelcoach.com writes it
  return {
    pageviews: days.map((d, i) => ({ x: day(d), y: level * 3 + (i % 7) * 2 })),
    // A day without visits is left out, as Umami does.
    sessions: days.filter((_, i) => i % 11 !== 3).map((d, i) => ({ x: day(d), y: level + (i % 5) })),
  };
}

function umami(method: string, path: string, query: URLSearchParams, body: unknown, auth: string | undefined, failBg: boolean): [number, unknown] {
  if (path === '/api/auth/login' && method === 'POST') {
    umamiCalls.login++;
    const b = body as { username?: string; password?: string };
    return b?.username === 'console' && b?.password === 'e2e-umami-pw' ? [200, { token: UMAMI_TOKEN, user: { role: 'view-only' } }] : [401, { error: 'unauthorized' }];
  }
  const m = /^\/api\/websites\/([0-9a-f-]+)\/pageviews$/.exec(path);
  if (m && method === 'GET') {
    umamiCalls.pageviews++;
    if (auth !== `Bearer ${UMAMI_TOKEN}`) return [401, { error: 'unauthorized' }];
    if (failBg && m[1] === BG_UMAMI) return [500, { error: 'boom' }];
    return [200, pageviews(m[1]!, Number(query.get('startAt')), Number(query.get('endAt')))];
  }
  return [404, { error: 'not_found' }];
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${FAKES_PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  let path = url.pathname;
  if (path === '/__reset') return (seed(), send(200, { ok: true }));
  if (path === '/__stats') return send(200, umamiCalls);
  if (path.startsWith('/down/')) return send(503, { error: 'down' });
  const failBg = path.startsWith('/fail-bg/');
  if (failBg) path = path.slice('/fail-bg'.length);

  if (path.startsWith('/api/admin/v1/')) {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' });
    const [status, data] = adminApi(req.method ?? 'GET', path.slice('/api/admin/v1'.length), url.searchParams, body);
    return send(status, data);
  }
  const [status, data] = umami(req.method ?? 'GET', path, url.searchParams, body, req.headers.authorization, failBg);
  return send(status, data);
}).listen(FAKES_PORT, 'localhost', () => console.log(`Fakes on http://localhost:${FAKES_PORT}`));
