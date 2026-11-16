import type { APIRoute } from 'astro';
import { backTo, runAction } from '../../../lib/actions.ts';
import { getContext } from '../../../lib/context.ts';

/** Block or unblock a reader; back to the same list. */
export const POST: APIRoute = async (ctx) => {
  const action = ctx.params.action ?? '';
  if (action !== 'block' && action !== 'unblock') return new Response('Not found', { status: 404 });
  const deps = getContext();
  const form = await ctx.request.formData();
  const notice = await runAction(deps, action, ctx.params.id, form);
  return ctx.redirect(backTo(deps, form.get('back'), notice), 303);
};
