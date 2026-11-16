/**
 * Google Search Console client (spec console-search), read-only, as a service account.
 * Sign-in: an RS256 JWT signed with node:crypto, exchanged at Google's token endpoint
 * (no Google library). Data: POST /webmasters/v3/sites/{property}/searchAnalytics/query.
 * Dates are Google's (Pacific Time) days, YYYY-MM-DD.
 */
import { createSign } from 'node:crypto';

export const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

export class SearchConsoleError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface DailyRow {
  day: string;
  clicks: number;
  impressions: number;
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  /** 0..1 */
  ctr: number;
  position: number;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/** The signed assertion of the JWT bearer grant (RFC 7523). */
export function signAssertion(p: { clientEmail: string; privateKey: string; tokenUrl: string; now: number }): string {
  const iat = Math.floor(p.now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: p.clientEmail, scope: SCOPE, aud: p.tokenUrl, iat, exp: iat + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(p.privateKey);
  return `${header}.${claims}.${b64url(signature)}`;
}

export class SearchConsoleClient {
  private readonly clientEmail: string;
  private readonly privateKey: string;
  private readonly apiUrl: string;
  private readonly tokenUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private token: { value: string; expiresAt: number } | undefined;
  private signingIn: Promise<string> | undefined;

  constructor(p: { clientEmail: string; privateKey: string; apiUrl: string; tokenUrl: string; fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number }) {
    this.clientEmail = p.clientEmail;
    this.privateKey = p.privateKey;
    this.apiUrl = p.apiUrl;
    this.tokenUrl = p.tokenUrl;
    this.fetchImpl = p.fetchImpl ?? fetch;
    this.now = p.now ?? Date.now;
    this.timeoutMs = p.timeoutMs ?? 10_000;
  }

  /** An access token, reused until five minutes before it expires; one sign-in shared by parallel requests. */
  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 5 * 60_000 > this.now()) return this.token.value;
    this.signingIn ??= (async () => {
      try {
        const assertion = signAssertion({ clientEmail: this.clientEmail, privateKey: this.privateKey, tokenUrl: this.tokenUrl, now: this.now() });
        let res: Response;
        try {
          res = await this.fetchImpl(this.tokenUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
        } catch (err) {
          throw new SearchConsoleError(`Google token endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`);
        }
        const body = (await res.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown; error?: unknown };
        if (!res.ok || typeof body.access_token !== 'string') {
          throw new SearchConsoleError(`Google token endpoint answered ${res.status}${body.error ? ` (${String(body.error)})` : ''}`, res.status);
        }
        const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
        this.token = { value: body.access_token, expiresAt: this.now() + expiresIn * 1000 };
        return body.access_token;
      } finally {
        this.signingIn = undefined;
      }
    })();
    return this.signingIn;
  }

  private async query(property: string, body: Record<string, unknown>): Promise<{ keys?: unknown[]; clicks?: unknown; impressions?: unknown; ctr?: unknown; position?: unknown }[]> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.apiUrl}/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ type: 'web', ...body }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SearchConsoleError(`Search Console unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.status === 401) this.token = undefined; // next request signs in again
    if (!res.ok) throw new SearchConsoleError(`Search Console answered ${res.status} for ${property}`, res.status);
    const json = (await res.json().catch(() => null)) as { rows?: unknown } | null;
    if (!json || typeof json !== 'object') throw new SearchConsoleError(`Search Console sent no JSON for ${property}`);
    if (json.rows === undefined) return []; // no data in the period
    if (!Array.isArray(json.rows)) throw new SearchConsoleError(`Unexpected Search Console answer for ${property}`);
    return json.rows as never;
  }

  private static num(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new SearchConsoleError(`Unexpected Search Console value: ${JSON.stringify(v)}`);
    return n;
  }

  /** Clicks and impressions per day; days without impressions are absent. */
  async daily(property: string, startDate: string, endDate: string): Promise<DailyRow[]> {
    const rows = await this.query(property, { startDate, endDate, dimensions: ['date'], rowLimit: 1000 });
    return rows.map((r) => {
      const day = r.keys?.[0];
      if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SearchConsoleError(`Unexpected Search Console date: ${JSON.stringify(r.keys)}`);
      return { day, clicks: SearchConsoleClient.num(r.clicks), impressions: SearchConsoleClient.num(r.impressions) };
    });
  }

  /** The searches with most clicks in the period (Search Console orders by clicks). */
  async topQueries(property: string, startDate: string, endDate: string, limit = 25): Promise<QueryRow[]> {
    const rows = await this.query(property, { startDate, endDate, dimensions: ['query'], rowLimit: limit });
    return rows.map((r) => ({
      query: String(r.keys?.[0] ?? ''),
      clicks: SearchConsoleClient.num(r.clicks),
      impressions: SearchConsoleClient.num(r.impressions),
      ctr: SearchConsoleClient.num(r.ctr),
      position: SearchConsoleClient.num(r.position),
    }));
  }
}
