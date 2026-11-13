import { type DB, getMeta, setMeta } from './db.ts';
import type { Mailer } from './mailer.ts';
import type { Sites } from './sites.ts';
import { type Clock, HOUR } from './util.ts';

export const NOTIFY_DELAY = 6 * HOUR;
const KEY = 'last_notified_comment_at';

/**
 * Emails the admin about new comments. A mail goes out once the oldest comment not yet
 * notified is 6 hours old, listing every comment posted since: comments arriving
 * together share one mail, and there is at most one mail per 6 hours.
 */
export class Notifier {
  private readonly db: DB;
  private readonly mailer: Mailer;
  private readonly sites: Sites;
  private readonly adminEmail: string;
  private readonly baseUrl: string;
  private readonly now: Clock;
  private running = false;

  constructor(p: { db: DB; mailer: Mailer; sites: Sites; adminEmail: string; baseUrl: string; now: Clock }) {
    this.db = p.db;
    this.mailer = p.mailer;
    this.sites = p.sites;
    this.adminEmail = p.adminEmail;
    this.baseUrl = p.baseUrl;
    this.now = p.now;
  }

  async tick(): Promise<boolean> {
    if (!this.adminEmail || this.running) return false;
    this.running = true;
    try {
      const last = Number(getMeta(this.db, KEY) ?? 0);
      const rows = this.db
        .prepare("SELECT site_id, path, body, created_at FROM comments WHERE created_at > ? AND status = 'pending' ORDER BY created_at")
        .all(last) as { site_id: string; path: string; body: string; created_at: number }[];
      const oldest = rows[0];
      if (!oldest || this.now() - oldest.created_at < NOTIFY_DELAY) return false;
      const lines = rows.map((r) => {
        const site = this.sites.get(r.site_id)?.name ?? r.site_id;
        const excerpt = r.body.length > 200 ? `${r.body.slice(0, 200)}…` : r.body;
        return `- ${site} ${r.path}\n  ${excerpt.replace(/\n/g, '\n  ')}`;
      });
      await this.mailer.send({
        to: this.adminEmail,
        subject: `${rows.length} new comment${rows.length > 1 ? 's' : ''} to moderate`,
        text: `${lines.join('\n\n')}\n\nModerate: ${this.baseUrl}/admin\n`,
      });
      setMeta(this.db, KEY, String(rows.at(-1)!.created_at));
      return true;
    } finally {
      this.running = false;
    }
  }
}
