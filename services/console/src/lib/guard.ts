/** Paths reachable without signing in. */
const PUBLIC = new Set(['/healthz', '/login', '/auth/google', '/auth/google/callback', '/auth/dev', '/favicon.svg', '/robots.txt']);

export function isPublic(pathname: string): boolean {
  return PUBLIC.has(pathname) || pathname.startsWith('/_astro/');
}

export type GuardDecision = { kind: 'pass' } | { kind: 'login'; to: string } | { kind: 'forbidden'; reason: string };

/**
 * What the middleware does with a request (spec admin-console): state-changing requests
 * only from the console's own pages (Origin = CONSOLE_URL), sign-in everywhere but the
 * public paths.
 */
export function guard(p: { method: string; pathname: string; search: string; origin: string | null; signedIn: boolean; consoleUrl: string }): GuardDecision {
  const safe = p.method === 'GET' || p.method === 'HEAD';
  if (!safe && p.origin !== new URL(p.consoleUrl).origin) return { kind: 'forbidden', reason: 'cross-site request' };
  if (isPublic(p.pathname) || p.signedIn) return { kind: 'pass' };
  if (!safe) return { kind: 'forbidden', reason: 'not signed in' };
  return { kind: 'login', to: `/login?${new URLSearchParams({ next: p.pathname + p.search })}` };
}
