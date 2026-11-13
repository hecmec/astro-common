import { type DB, transaction } from './db.ts';
import type { Lang } from './sites.ts';
import { DAY, MINUTE, randomToken, sha256 } from './util.ts';

export const SESSION_TTL = 90 * DAY;
export const FLOW_TTL = 20 * MINUTE;
export const LINK_TTL = 15 * MINUTE;
export const ADMIN_SITE = '__admin';

export interface User {
  id: number;
  email: string;
  google_sub: string | null;
  display_name: string | null;
  created_at: number;
  blocked_at: number | null;
}

export interface Flow {
  id_hash: string;
  kind: 'reader' | 'admin';
  site_id: string;
  origin: string;
  lang: Lang;
  oauth_state_hash: string | null;
  code_verifier: string | null;
  session_token: string | null;
  created_at: number;
  expires_at: number;
  completed_at: number | null;
}

export type Status = 'pending' | 'published' | 'refused';

export interface CommentRow {
  id: number;
  site_id: string;
  path: string;
  lang: string;
  user_id: number | null;
  body: string;
  status: Status;
  created_at: number;
  moderated_at: number | null;
  published_at: number | null;
  sticky: number;
  display_name: string | null;
  reply_body: string | null;
  reply_created_at: number | null;
}

// ---- users and sessions -------------------------------------------------

export function findOrCreateUser(db: DB, email: string, now: number, googleSub?: string): User {
  email = email.toLowerCase();
  db.prepare('INSERT INTO users (email, google_sub, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING').run(
    email,
    googleSub ?? null,
    now,
  );
  if (googleSub) db.prepare('UPDATE users SET google_sub = ? WHERE email = ? AND google_sub IS NULL').run(googleSub, email);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as unknown as User;
}

export function getUser(db: DB, id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as User | undefined;
}

export function createSession(db: DB, userId: number, siteId: string, now: number): string {
  const token = randomToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, site_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    sha256(token),
    userId,
    siteId,
    now,
    now + SESSION_TTL,
  );
  return token;
}

/** The user of a session, only if the session belongs to `siteId` and has not expired. */
export function sessionUser(db: DB, token: string | undefined, siteId: string, now: number): User | undefined {
  if (!token) return undefined;
  return db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.site_id = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), siteId, now) as unknown as User | undefined;
}

export function deleteSession(db: DB, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function setDisplayName(db: DB, userId: number, name: string): void {
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, userId);
}

/** Deletes the account. With keepComments, published comments stay without an author ("Former reader"). */
export function deleteAccount(db: DB, userId: number, keepComments: boolean): void {
  transaction(db, () => {
    if (keepComments) db.prepare("DELETE FROM comments WHERE user_id = ? AND status != 'published'").run(userId);
    else db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
    // sessions and reactions cascade; remaining comments get user_id NULL
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
}

// ---- sign-in flows --------------------------------------------------------

export function createFlow(db: DB, f: { kind: 'reader' | 'admin'; siteId: string; origin: string; lang: Lang }, now: number): string {
  const id = randomToken();
  db.prepare(
    'INSERT INTO auth_flows (id_hash, kind, site_id, origin, lang, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(sha256(id), f.kind, f.siteId, f.origin, f.lang, now, now + FLOW_TTL);
  db.prepare('DELETE FROM auth_flows WHERE expires_at < ?').run(now - DAY);
  db.prepare('DELETE FROM login_links WHERE expires_at < ?').run(now - DAY);
  return id;
}

export function getFlow(db: DB, id: string | undefined, now: number): Flow | undefined {
  if (!id) return undefined;
  return db.prepare('SELECT * FROM auth_flows WHERE id_hash = ? AND expires_at > ?').get(sha256(id), now) as unknown as Flow | undefined;
}

export function getFlowByHash(db: DB, idHash: string, now: number): Flow | undefined {
  return db.prepare('SELECT * FROM auth_flows WHERE id_hash = ? AND expires_at > ?').get(idHash, now) as unknown as Flow | undefined;
}

export function setFlowOAuth(db: DB, idHash: string, state: string, verifier: string): void {
  db.prepare('UPDATE auth_flows SET oauth_state_hash = ?, code_verifier = ? WHERE id_hash = ?').run(sha256(state), verifier, idHash);
}

export function flowByOAuthState(db: DB, state: string | undefined, now: number): Flow | undefined {
  if (!state) return undefined;
  return db
    .prepare('SELECT * FROM auth_flows WHERE oauth_state_hash = ? AND expires_at > ? AND completed_at IS NULL')
    .get(sha256(state), now) as unknown as Flow | undefined;
}

/** Completes a flow: creates the session and, for readers, parks the token for the widget to pick up. */
export function completeFlow(db: DB, flow: Flow, user: User, now: number): string {
  const token = createSession(db, user.id, flow.kind === 'admin' ? ADMIN_SITE : flow.site_id, now);
  db.prepare('UPDATE auth_flows SET completed_at = ?, session_token = ?, code_verifier = NULL WHERE id_hash = ?').run(
    now,
    flow.kind === 'reader' ? token : null,
    flow.id_hash,
  );
  return token;
}

/** Hands the parked session token over once. */
export function takeFlowToken(db: DB, flow: Flow): string | null {
  if (!flow.session_token) return null;
  const res = db.prepare('UPDATE auth_flows SET session_token = NULL WHERE id_hash = ? AND session_token = ?').run(flow.id_hash, flow.session_token);
  return res.changes === 1 ? flow.session_token : null;
}

// ---- email links ----------------------------------------------------------

export function createLoginLink(db: DB, flow: Flow, email: string, now: number): string {
  const token = randomToken();
  db.prepare('INSERT INTO login_links (token_hash, flow_id_hash, email, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    flow.id_hash,
    email.toLowerCase(),
    now + LINK_TTL,
  );
  return token;
}

export interface LoginLink {
  token_hash: string;
  flow_id_hash: string;
  email: string;
  expires_at: number;
  used_at: number | null;
}

export function getLoginLink(db: DB, token: string | undefined, now: number): LoginLink | undefined {
  if (!token) return undefined;
  return db
    .prepare('SELECT * FROM login_links WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL')
    .get(sha256(token), now) as unknown as LoginLink | undefined;
}

/** Marks a link used; false if it was used meanwhile. */
export function useLoginLink(db: DB, link: LoginLink, now: number): boolean {
  return db.prepare('UPDATE login_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(now, link.token_hash).changes === 1;
}

// ---- comments -------------------------------------------------------------

const COMMENT_SELECT = `
  SELECT c.*, u.display_name, r.body AS reply_body, r.created_at AS reply_created_at
  FROM comments c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN replies r ON r.comment_id = c.id`;

export function insertComment(db: DB, c: { siteId: string; path: string; lang: Lang; userId: number; body: string }, now: number): number {
  const res = db
    .prepare("INSERT INTO comments (site_id, path, lang, user_id, body, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
    .run(c.siteId, c.path, c.lang, c.userId, c.body, now);
  return Number(res.lastInsertRowid);
}

export function getComment(db: DB, id: number): CommentRow | undefined {
  return db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(id) as unknown as CommentRow | undefined;
}

/** A page shows at most this many published comments: the most recent ones, plus every sticky one. */
export const MAX_COMMENTS_PER_PAGE = 300;

/**
 * Ids of the published comments a page keeps: its MAX_COMMENTS_PER_PAGE most recently
 * published, plus the sticky ones. `partition` ranks per page across a whole site.
 */
function keptCte(where: string, partition = ''): string {
  return `WITH kept AS (
    SELECT id FROM (
      SELECT id, sticky, ROW_NUMBER() OVER (${partition} ORDER BY published_at DESC, id DESC) AS rn
      FROM comments WHERE ${where} AND status = 'published'
    ) WHERE rn <= ${MAX_COMMENTS_PER_PAGE} OR sticky = 1
  )`;
}

/**
 * Published comments of a page that it keeps (optionally only those published after `after`),
 * plus the reader's own unpublished ones, most recent first.
 */
export function pageComments(db: DB, siteId: string, path: string, after: number | null, userId: number | null): CommentRow[] {
  return db
    .prepare(
      `${keptCte('site_id = ? AND path = ?')}
       ${COMMENT_SELECT}
       WHERE c.site_id = ? AND c.path = ?
         AND ((c.status = 'published' AND c.id IN (SELECT id FROM kept) AND (? IS NULL OR c.published_at > ?))
              OR (c.status != 'published' AND c.user_id IS NOT NULL AND c.user_id = ?))
       ORDER BY COALESCE(c.published_at, c.created_at) DESC, c.id DESC`,
    )
    .all(siteId, path, siteId, path, after, after, userId) as unknown as CommentRow[];
}

export function setSticky(db: DB, id: number, sticky: boolean): boolean {
  return db.prepare('UPDATE comments SET sticky = ? WHERE id = ?').run(sticky ? 1 : 0, id).changes === 1;
}

export function countUserComments(db: DB, userId: number, since: number): { recent: number; pending: number } {
  const row = db
    .prepare(
      `SELECT SUM(created_at > ?) AS recent, SUM(status = 'pending') AS pending FROM comments WHERE user_id = ?`,
    )
    .get(since, userId) as { recent: number | null; pending: number | null };
  return { recent: row.recent ?? 0, pending: row.pending ?? 0 };
}

export function deleteOwnComment(db: DB, id: number, userId: number, siteId: string): boolean {
  return db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ? AND site_id = ?').run(id, userId, siteId).changes === 1;
}

export function setStatus(db: DB, id: number, status: 'published' | 'refused', now: number): boolean {
  const res =
    status === 'published'
      ? db.prepare("UPDATE comments SET status = 'published', moderated_at = ?, published_at = ? WHERE id = ?").run(now, now, id)
      : db.prepare("UPDATE comments SET status = 'refused', moderated_at = ?, published_at = NULL WHERE id = ?").run(now, id);
  return res.changes === 1;
}

export function setReply(db: DB, commentId: number, body: string | null, now: number): void {
  if (!body) {
    db.prepare('DELETE FROM replies WHERE comment_id = ?').run(commentId);
    return;
  }
  db.prepare(
    `INSERT INTO replies (comment_id, body, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(comment_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
  ).run(commentId, body, now, now);
}

export function listComments(
  db: DB,
  f: { status?: Status; siteId?: string; path?: string; limit?: number },
): (CommentRow & { email: string | null; blocked_at: number | null })[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status) (where.push('c.status = ?'), params.push(f.status));
  if (f.siteId) (where.push('c.site_id = ?'), params.push(f.siteId));
  if (f.path) (where.push('c.path = ?'), params.push(f.path));
  const order = f.status === 'pending' ? 'c.created_at ASC' : 'c.created_at DESC';
  return db
    .prepare(
      `SELECT c.*, u.display_name, u.email, u.blocked_at, r.body AS reply_body, r.created_at AS reply_created_at
       FROM comments c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN replies r ON r.comment_id = c.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${order} LIMIT ?`,
    )
    .all(...params, f.limit ?? 200) as unknown as (CommentRow & { email: string | null; blocked_at: number | null })[];
}

export function setBlocked(db: DB, userId: number, blocked: boolean, now: number): void {
  transaction(db, () => {
    db.prepare('UPDATE users SET blocked_at = ? WHERE id = ?').run(blocked ? now : null, userId);
    if (blocked) {
      db.prepare("UPDATE comments SET status = 'refused', moderated_at = ? WHERE user_id = ? AND status = 'pending'").run(now, userId);
    }
  });
}

/**
 * Published comments whose publication is at or before `cutoff`, for the static export,
 * limited to those their page keeps (most recent MAX_COMMENTS_PER_PAGE plus sticky ones).
 */
export function exportComments(db: DB, siteId: string, cutoff: number): CommentRow[] {
  return db
    .prepare(
      `${keptCte('site_id = ?', 'PARTITION BY path')}
       ${COMMENT_SELECT}
       WHERE c.site_id = ? AND c.status = 'published' AND c.id IN (SELECT id FROM kept) AND c.published_at <= ?
       ORDER BY c.path, c.published_at DESC, c.id DESC`,
    )
    .all(siteId, siteId, cutoff) as unknown as CommentRow[];
}

// ---- reactions ------------------------------------------------------------

export function reactionCounts(db: DB, siteId: string, path: string): Map<string, number> {
  const rows = db
    .prepare('SELECT kind, COUNT(*) AS n FROM reactions WHERE site_id = ? AND path = ? GROUP BY kind')
    .all(siteId, path) as { kind: string; n: number }[];
  return new Map(rows.map((r) => [r.kind, r.n]));
}

export function userReactions(db: DB, siteId: string, path: string, userId: number): Set<string> {
  const rows = db.prepare('SELECT kind FROM reactions WHERE site_id = ? AND path = ? AND user_id = ?').all(siteId, path, userId) as {
    kind: string;
  }[];
  return new Set(rows.map((r) => r.kind));
}

export function setReaction(db: DB, r: { siteId: string; path: string; userId: number; kind: string; on: boolean }, now: number): void {
  if (r.on) {
    db.prepare('INSERT INTO reactions (site_id, path, user_id, kind, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').run(
      r.siteId,
      r.path,
      r.userId,
      r.kind,
      now,
    );
  } else {
    db.prepare('DELETE FROM reactions WHERE site_id = ? AND path = ? AND user_id = ? AND kind = ?').run(r.siteId, r.path, r.userId, r.kind);
  }
}

export function allReactionCounts(db: DB, siteId: string): { path: string; kind: string; n: number }[] {
  return db
    .prepare('SELECT path, kind, COUNT(*) AS n FROM reactions WHERE site_id = ? GROUP BY path, kind')
    .all(siteId) as { path: string; kind: string; n: number }[];
}
