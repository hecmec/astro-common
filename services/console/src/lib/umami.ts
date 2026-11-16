/**
 * Umami v3 client (self-hosted, stats.babelcoach.com), with a view-only account.
 * POST /api/auth/login -> { token }; GET /api/websites/:id/pageviews?startAt&endAt&unit&timezone
 * -> { pageviews: [{ x, y }], sessions: [{ x, y }] }, where x is the bucket's wall-clock
 * time in the requested timezone: "YYYY-MM-DD HH:MM:SS" on stats.babelcoach.com (recorded
 * in test/fixtures/umami), "YYYY-MM-DDTHH:MM:SSZ" with a literal Z (not UTC) in newer
 * Umami source. Both are read by their date part. Days without visits are left out.
 */

export interface Point {
  /** Day, YYYY-MM-DD, in the requested timezone. */
  day: string;
  value: number;
}

export interface DailyStats {
  pageviews: Point[];
  sessions: Point[];
}

export class UmamiError extends Error {}

/** The day of an Umami bucket: the date part of x, whatever the separator or suffix. */
export function bucketDay(x: unknown): string | undefined {
  if (typeof x !== 'string') return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(x);
  return m?.[1];
}

function points(rows: unknown): Point[] {
  if (!Array.isArray(rows)) throw new UmamiError('Unexpected Umami answer: no series');
  const out: Point[] = [];
  for (const r of rows as { x?: unknown; y?: unknown }[]) {
    const day = bucketDay(r?.x);
    const value = Number(r?.y);
    if (!day || !Number.isFinite(value)) throw new UmamiError(`Unexpected Umami bucket: ${JSON.stringify(r)}`);
    out.push({ day, value });
  }
  return out;
}

export class UmamiClient {
  private readonly url: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private token: string | undefined;
  private loggingIn: Promise<string> | undefined;

  constructor(p: { url: string; username: string; password: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
    this.url = p.url;
    this.username = p.username;
    this.password = p.password;
    this.fetchImpl = p.fetchImpl ?? fetch;
    this.timeoutMs = p.timeoutMs ?? 8000;
  }

  private async login(): Promise<string> {
    // One login at a time, shared by the parallel requests of a page.
    this.loggingIn ??= (async () => {
      try {
        const res = await this.fetchImpl(`${this.url}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) throw new UmamiError(`Umami login answered ${res.status}`);
        const body = (await res.json()) as { token?: unknown; requiresTwoFactor?: unknown };
        if (body.requiresTwoFactor) throw new UmamiError('The Umami account has two-factor sign-in; the console needs an account without it');
        if (typeof body.token !== 'string') throw new UmamiError('Umami login returned no token');
        this.token = body.token;
        return body.token;
      } finally {
        this.loggingIn = undefined;
      }
    })();
    return this.loggingIn;
  }

  private async get(path: string, retry = true): Promise<unknown> {
    const token = this.token ?? (await this.login());
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.url}${path}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new UmamiError(`Umami unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.status === 401 && retry) {
      // Expired token: log in once more, then give up.
      if (this.token === token) this.token = undefined;
      return this.get(path, false);
    }
    if (!res.ok) throw new UmamiError(`Umami answered ${res.status} for ${path.split('?')[0]}`);
    return res.json();
  }

  async daily(websiteId: string, p: { startAt: number; endAt: number; timezone: string }): Promise<DailyStats> {
    const q = new URLSearchParams({ startAt: String(p.startAt), endAt: String(p.endAt), unit: 'day', timezone: p.timezone });
    const body = (await this.get(`/api/websites/${encodeURIComponent(websiteId)}/pageviews?${q}`)) as { pageviews?: unknown; sessions?: unknown };
    return { pageviews: points(body?.pageviews), sessions: points(body?.sessions) };
  }
}
