import { type APIRequestContext, request } from '@playwright/test';

export const A = 'http://localhost:4386';
export const B = 'http://localhost:4387';
export const C = 'http://localhost:4388';
export const FAKES = 'http://localhost:4389';
export const ADMIN = 'admin@example.org';

export async function resetFakes(): Promise<void> {
  const r = await request.newContext();
  await r.post(`${FAKES}/__reset`);
  await r.dispose();
}

export async function umamiCalls(): Promise<{ login: number; pageviews: number; gscToken: number; gscQuery: number }> {
  const r = await request.newContext();
  const stats = await (await r.get(`${FAKES}/__stats`)).json();
  await r.dispose();
  return stats;
}

/** An HTTP client signed in with the dev sign-in (cookies kept in the context). */
export async function signedIn(base = A, email = ADMIN): Promise<APIRequestContext> {
  const r = await request.newContext({ baseURL: base, extraHTTPHeaders: { origin: base } });
  const res = await r.post('/auth/dev', { form: { email, next: '/comments' }, maxRedirects: 0 });
  if (res.status() !== 303) throw new Error(`dev sign-in failed: ${res.status()}`);
  return r;
}

/** POST a console form the way a browser on the console would (Origin set), without following the redirect. */
export function postForm(r: APIRequestContext, path: string, form: Record<string, string>) {
  return r.post(path, { form, maxRedirects: 0 });
}
