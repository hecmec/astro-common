import type { APIRoute } from 'astro';
import { backTo, runAction } from '../../../lib/actions.ts';
import { getContext } from '../../../lib/context.ts';

const ACTIONS = new Set(['publish', 'refuse', 'sticky', 'unsticky', 'reply']);

/** Moderation of one comment; post/redirect/get back to the same list. */
export const POST: APIRoute = async (ctx) => {
  const action = ctx.params.action ?? '';
  if (!ACTIONS.has(action)) return new Response('Not found', { status: 404 });
  const deps = getContext();
  const form = await ctx.request.formData();
  const notice = await runAction(deps, action, ctx.params.id, form);
  return ctx.redirect(backTo(deps, form.get('back'), notice), 303);
};
