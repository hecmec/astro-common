import { defineMiddleware } from 'astro:middleware';
import { getContext } from './lib/context.ts';
import { guard } from './lib/guard.ts';
import { SESSION_COOKIE, sessionEmail } from './lib/session.ts';

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { config, now } = getContext();
  const email = sessionEmail(config.sessionSecret, ctx.cookies.get(SESSION_COOKIE)?.value, config.adminEmails, now());
  const decision = guard({
    method: ctx.request.method,
    pathname: ctx.url.pathname,
    search: ctx.url.search,
    origin: ctx.request.headers.get('origin'),
    signedIn: !!email,
    consoleUrl: config.consoleUrl,
  });
  if (decision.kind === 'forbidden') return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain' } });
  if (decision.kind === 'login') return ctx.redirect(decision.to, 302);
  ctx.locals.email = email;

  const res = await next();
  res.headers.set('x-content-type-options', 'nosniff');
  // same-origin, not no-referrer: with no-referrer browsers send "Origin: null" on form posts.
  res.headers.set('referrer-policy', 'same-origin');
  if (res.headers.get('content-type')?.startsWith('text/html')) {
    res.headers.set('x-frame-options', 'DENY');
    res.headers.set('cache-control', 'no-store');
    // Not in development: Vite injects inline scripts there.
    if (import.meta.env.PROD) res.headers.set('content-security-policy', CSP);
  }
  return res;
});
