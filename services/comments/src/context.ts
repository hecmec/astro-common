import type { Context } from 'hono';
import type { Config } from './config.ts';
import type { DB } from './db.ts';
import type { GoogleProvider } from './google.ts';
import type { Mailer } from './mailer.ts';
import { RateLimiter } from './ratelimit.ts';
import type { Sites } from './sites.ts';
import { type Clock, MINUTE } from './util.ts';

export interface Deps {
  config: Config;
  sites: Sites;
  db: DB;
  mailer: Mailer;
  google?: GoogleProvider;
  now: Clock;
  /** Called after a comment is posted (wakes the admin notifier). */
  onNewComment?: () => void;
}

export interface Limits {
  flows: RateLimiter;
  emails: RateLimiter;
}

export function createLimits(now: Clock): Limits {
  return {
    flows: new RateLimiter(20, 60 * MINUTE, now),
    emails: new RateLimiter(5, 60 * MINUTE, now),
  };
}

/** Client IP: from X-Forwarded-For behind a trusted proxy, else from the socket. */
export async function clientIp(c: Context, trustProxy: boolean): Promise<string> {
  if (trustProxy) {
    const fwd = c.req.header('x-forwarded-for');
    if (fwd) return fwd.split(',')[0]!.trim();
  }
  try {
    const { getConnInfo } = await import('@hono/node-server/conninfo');
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function bearer(c: Context): string | undefined {
  const h = c.req.header('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
}
