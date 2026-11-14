import { createHash } from 'node:crypto';
import type { DB } from './db.ts';
import type { Site } from './sites.ts';
import { allReactionCounts, exportComments } from './store.ts';
import { DAY, iso } from './util.ts';

export interface ExportComment {
  id: number;
  author: string | null; // null: "Former reader"
  body: string;
  created_at: string | null;
  published_at: string | null;
  reply: { body: string; created_at: string | null } | null;
}

export interface SiteExport {
  site: string;
  name: string;
  cutoff: string | null;
  generated_at: string | null;
  reactions: Site['reactions'];
  pages: Record<string, { comments: ExportComment[]; reactions: Record<string, number> }>;
}

/** Published comments older than the site's delay (as kept per page), replies and reaction counts. */
export function buildExport(db: DB, site: Site, now: number): SiteExport {
  const cutoff = now - site.bakeAfterDays * DAY;
  const pages: SiteExport['pages'] = {};
  const page = (path: string) => (pages[path] ??= { comments: [], reactions: {} });
  for (const row of exportComments(db, site.id, cutoff)) {
    page(row.path).comments.push({
      id: row.id,
      author: row.display_name ?? null,
      body: row.body,
      created_at: iso(row.created_at),
      published_at: iso(row.published_at),
      reply: row.reply_body ? { body: row.reply_body, created_at: iso(row.reply_created_at) } : null,
    });
  }
  for (const r of allReactionCounts(db, site.id)) {
    if (site.reactions.some((k) => k.id === r.kind)) page(r.path).reactions[r.kind] = r.n;
  }
  return { site: site.id, name: site.name, cutoff: iso(cutoff), generated_at: iso(now), reactions: site.reactions, pages };
}

/**
 * What a site build would bake, as a hash: comments, authors, texts, dates, replies and
 * reaction counts. The cutoff and generation dates are left out, so a day passing without
 * any comment crossing the delay gives the same fingerprint.
 */
export function exportFingerprint(e: SiteExport): string {
  const paths = Object.keys(e.pages).sort();
  const canonical = paths.map((p) => {
    const pg = e.pages[p]!;
    return [p, pg.comments, Object.keys(pg.reactions).sort().map((k) => [k, pg.reactions[k]])];
  });
  return createHash('sha256').update(JSON.stringify([e.name, e.reactions, canonical])).digest('hex');
}
