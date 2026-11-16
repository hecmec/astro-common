import { STATUSES, type Status } from './comments-api.ts';
import type { Sites } from './sites.ts';

/** Filters of the Comments page, kept in its query string. */
export interface CommentFilters {
  status: Status;
  site?: string;
  path?: string;
}

export function parseFilters(params: URLSearchParams, sites: Sites): CommentFilters {
  const status = STATUSES.find((s) => s === params.get('status')) ?? 'pending';
  const siteParam = params.get('site');
  const site = sites.some((s) => s.id === siteParam) ? siteParam! : undefined;
  const raw = params.get('path')?.trim();
  const path = raw && raw.startsWith('/') && !raw.startsWith('//') && raw.length <= 300 ? raw : undefined;
  return { status, site, path };
}

/** Query string of the Comments page for these filters (status first, then site and path). */
export function filtersQuery(f: CommentFilters): string {
  const q = new URLSearchParams({ status: f.status });
  if (f.site) q.set('site', f.site);
  if (f.path) q.set('path', f.path);
  return q.toString();
}

/** Notices shown after an action, by the code the action endpoints put in `notice`. */
export const NOTICES: Record<string, { text: string; error: boolean }> = {
  published: { text: 'Comment published.', error: false },
  refused: { text: 'Comment refused.', error: false },
  sticky: { text: 'Comment marked sticky.', error: false },
  unsticky: { text: 'Sticky mark removed.', error: false },
  replied: { text: 'Reply saved.', error: false },
  reply_removed: { text: 'Reply removed.', error: false },
  blocked: { text: 'Reader blocked; their pending comments were refused.', error: false },
  unblocked: { text: 'Reader unblocked.', error: false },
  rebuilt: { text: 'Rebuild check done for all sites.', error: false },
  not_found: { text: 'That comment or reader no longer exists.', error: true },
  not_published: { text: 'Only a published comment can be made sticky or get a reply.', error: true },
  invalid: { text: 'That request was not valid.', error: true },
  unavailable: { text: 'The comments service is unavailable; nothing was changed.', error: true },
};
