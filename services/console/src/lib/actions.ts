import { COMMENT_ACTIONS, type CommentAction, CommentsApiError, CommentsUnavailable } from './comments-api.ts';
import type { ConsoleContext } from './context.ts';
import { filtersQuery, parseFilters } from './filters.ts';

export type ActionName = CommentAction | 'reply' | 'block' | 'unblock' | 'rebuild';

const DONE: Record<CommentAction, string> = { publish: 'published', refuse: 'refused', sticky: 'sticky', unsticky: 'unsticky' };

/** Where an action lands: the list it came from (status, site, page) with a notice. */
export function backTo(ctx: ConsoleContext, back: FormDataEntryValue | null, notice: string): string {
  const q = filtersQuery(parseFilters(new URLSearchParams(typeof back === 'string' ? back : ''), ctx.sites));
  return `/comments?${q}&notice=${notice}`;
}

function errorNotice(err: unknown): string {
  if (err instanceof CommentsApiError) return err.status === 404 ? 'not_found' : err.status === 409 ? 'not_published' : 'invalid';
  if (err instanceof CommentsUnavailable) {
    console.error(err.message);
    return 'unavailable';
  }
  throw err;
}

/** Runs one moderation action on the comments service and returns the notice code. */
export async function runAction(ctx: ConsoleContext, name: string, id: string | undefined, form: FormData): Promise<string> {
  const n = Number(id);
  const validId = name === 'rebuild' || (Number.isInteger(n) && n > 0);
  if (!validId) return 'invalid';
  try {
    if ((COMMENT_ACTIONS as string[]).includes(name)) {
      await ctx.comments.act(n, name as CommentAction);
      return DONE[name as CommentAction];
    }
    if (name === 'reply') {
      const body = String(form.get('body') ?? '').replace(/\r\n?/g, '\n').trim();
      await ctx.comments.reply(n, body);
      return body ? 'replied' : 'reply_removed';
    }
    if (name === 'block' || name === 'unblock') {
      await ctx.comments.user(n, name);
      return name === 'block' ? 'blocked' : 'unblocked';
    }
    if (name === 'rebuild') {
      await ctx.comments.runRebuilds();
      return 'rebuilt';
    }
    return 'invalid';
  } catch (err) {
    return errorNotice(err);
  }
}
