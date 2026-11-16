/** Client of the comments service's admin API (spec comment-admin-api). Server side only. */

export type Status = 'pending' | 'published' | 'refused';
export const STATUSES: Status[] = ['pending', 'published', 'refused'];
export type Counts = Record<Status, number>;

export interface AdminComment {
  id: number;
  site: string;
  path: string;
  url: string;
  lang: string;
  status: Status;
  created_at: string;
  published_at: string | null;
  author: string | null;
  email: string | null;
  user_id: number | null;
  blocked: boolean;
  sticky: boolean;
  body: string;
  reply: { body: string; created_at: string | null } | null;
}

export interface Summary {
  sites: Record<string, Counts & { name: string }>;
  all: Counts;
}

export interface RebuildStatus {
  checked_at: string;
  result: 'requested' | 'unchanged' | 'failed';
  error?: string;
}

export type Rebuilds =
  | { enabled: false }
  | { enabled: true; at: string; timezone: string; sites: { id: string; name: string; status: RebuildStatus | null }[] };

export type CommentAction = 'publish' | 'refuse' | 'sticky' | 'unsticky';
export const COMMENT_ACTIONS: CommentAction[] = ['publish', 'refuse', 'sticky', 'unsticky'];

/** The comments service could not be reached or did not answer properly. */
export class CommentsUnavailable extends Error {}

/** The comments service refused the request (404 unknown comment, 409 not published, 400...). */
export class CommentsApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`Comments service answered ${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

export class CommentsApi {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(p: { baseUrl: string; token: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
    this.base = `${p.baseUrl}/api/admin/v1`;
    this.token = p.token;
    this.fetchImpl = p.fetchImpl ?? fetch;
    this.timeoutMs = p.timeoutMs ?? 5000;
  }

  private async call<T>(method: string, path: string, json?: unknown): Promise<T> {
    if (!this.token) throw new CommentsUnavailable('CONSOLE_TOKEN is not set');
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: 'application/json',
          ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new CommentsUnavailable(`Comments service unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    // 401: wrong token, 404 on every path: admin API off; both are configuration problems.
    if (res.status >= 500 || res.status === 401 || (res.status === 404 && path === '/summary')) {
      throw new CommentsUnavailable(`Comments service answered ${res.status}`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new CommentsUnavailable(`Comments service sent no JSON (${res.status})`);
    }
    if (!res.ok) throw new CommentsApiError(res.status, String((body as { error?: unknown })?.error ?? 'error'));
    return body as T;
  }

  summary(): Promise<Summary> {
    return this.call('GET', '/summary');
  }

  comments(f: { status?: Status; site?: string; path?: string }): Promise<{ comments: AdminComment[]; counts: Counts }> {
    const q = new URLSearchParams();
    if (f.status) q.set('status', f.status);
    if (f.site) q.set('site', f.site);
    if (f.path) q.set('path', f.path);
    return this.call('GET', `/comments${q.size ? `?${q}` : ''}`);
  }

  act(id: number, action: CommentAction): Promise<{ comment: AdminComment }> {
    return this.call('POST', `/comments/${id}/${action}`);
  }

  reply(id: number, body: string): Promise<{ comment: AdminComment }> {
    return this.call('PUT', `/comments/${id}/reply`, { body });
  }

  user(id: number, action: 'block' | 'unblock'): Promise<{ user: { id: number; blocked: boolean } }> {
    return this.call('POST', `/users/${id}/${action}`);
  }

  rebuilds(): Promise<Rebuilds> {
    return this.call('GET', '/rebuilds');
  }

  runRebuilds(): Promise<Rebuilds> {
    return this.call('POST', '/rebuilds');
  }
}
