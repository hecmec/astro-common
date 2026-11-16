import type { APIRoute } from 'astro';
import { devSignIn } from '../../lib/auth.ts';
import { getContext } from '../../lib/context.ts';
import { SESSION_COOKIE, SESSION_TTL, cookieOptions, sessionValue } from '../../lib/session.ts';

/** Development sign-in (DEV_MODE only, never in production). */
export const POST: APIRoute = async (ctx) => {
  const deps = getContext();
  const form = await ctx.request.formData();
  const result = devSignIn(deps.config, String(form.get('email') ?? ''), String(form.get('next') ?? ''));
  if (!result) return new Response('Not found', { status: 404 });
  if (!result.ok) return ctx.redirect(`/login?${new URLSearchParams({ error: result.error, email: result.email ?? '' })}`, 303);
  ctx.cookies.set(SESSION_COOKIE, sessionValue(deps.config.sessionSecret, result.email, deps.now()), cookieOptions(deps.config.production, SESSION_TTL));
  return ctx.redirect(result.next, 303);
};
