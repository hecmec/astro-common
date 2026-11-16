import type { APIRoute } from 'astro';
import { startGoogle } from '../../lib/auth.ts';
import { getContext } from '../../lib/context.ts';
import { OAUTH_COOKIE, OAUTH_TTL, cookieOptions } from '../../lib/session.ts';

/** Starts the Google sign-in: state and PKCE verifier in a short signed cookie. */
export const GET: APIRoute = (ctx) => {
  const deps = getContext();
  const start = startGoogle(deps, ctx.url.searchParams.get('next'));
  if (!start) return ctx.redirect('/login?error=google_off', 303);
  ctx.cookies.set(OAUTH_COOKIE, start.cookie, cookieOptions(deps.config.production, OAUTH_TTL));
  return ctx.redirect(start.redirect, 302);
};
