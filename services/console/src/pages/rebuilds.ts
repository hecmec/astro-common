import type { APIRoute } from 'astro';
import { backTo, runAction } from '../lib/actions.ts';
import { getContext } from '../lib/context.ts';

/** "Rebuild changed sites now". */
export const POST: APIRoute = async (ctx) => {
  const deps = getContext();
  const form = await ctx.request.formData();
  const notice = await runAction(deps, 'rebuild', undefined, form);
  return ctx.redirect(backTo(deps, form.get('back'), notice), 303);
};
