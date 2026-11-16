import type { APIRoute } from 'astro';
import { finishGoogle } from '../../../lib/auth.ts';
import { getContext } from '../../../lib/context.ts';
import { OAUTH_COOKIE, SESSION_COOKIE, SESSION_TTL, cookieOptions, sessionValue } from '../../../lib/session.ts';

export const GET: APIRoute = async (ctx) => {
  const deps = getContext();
  const result = await finishGoogle(deps, {
    state: ctx.url.searchParams.get('state'),
    code: ctx.url.searchParams.get('code'),
    cookie: ctx.cookies.get(OAUTH_COOKIE)?.value,
  });
  ctx.cookies.delete(OAUTH_COOKIE, { path: '/' });
  if (!result.ok) {
    const q = new URLSearchParams({ error: result.error });
    if (result.email) q.set('email', result.email);
    return ctx.redirect(`/login?${q}`, 303);
  }
  ctx.cookies.set(SESSION_COOKIE, sessionValue(deps.config.sessionSecret, result.email, deps.now()), cookieOptions(deps.config.production, SESSION_TTL));
  return ctx.redirect(result.next, 303);
};
