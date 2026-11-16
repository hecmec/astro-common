import { describe, expect, it } from 'vitest';
import { backTo, runAction } from '../src/lib/actions.ts';
import { CommentsApi } from '../src/lib/comments-api.ts';
import { createContext } from '../src/lib/context.ts';
import { config, fakeFetch, json, sites } from './helpers.ts';

function ctxWith(handler: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch(handler);
  const ctx = createContext(config(), sites);
  ctx.comments = new CommentsApi({ baseUrl: 'https://comments.test', token: 't'.repeat(40), fetchImpl: f.impl });
  return { ctx, calls: f.calls };
}

const form = (data: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};

describe('moderation actions', () => {
  it('call the matching admin API action and name the result', async () => {
    const { ctx, calls } = ctxWith(() => json({ comment: {}, user: {} }));
    expect(await runAction(ctx, 'publish', '5', form())).toBe('published');
    expect(await runAction(ctx, 'refuse', '5', form())).toBe('refused');
    expect(await runAction(ctx, 'sticky', '5', form())).toBe('sticky');
    expect(await runAction(ctx, 'unsticky', '5', form())).toBe('unsticky');
    expect(await runAction(ctx, 'reply', '5', form({ body: ' Thanks\r\nfor this ' }))).toBe('replied');
    expect(await runAction(ctx, 'reply', '5', form({ body: '  ' }))).toBe('reply_removed');
    expect(await runAction(ctx, 'block', '8', form())).toBe('blocked');
    expect(await runAction(ctx, 'unblock', '8', form())).toBe('unblocked');
    expect(await runAction(ctx, 'rebuild', undefined, form())).toBe('rebuilt');
    expect(calls.map((c) => `${c.init.method} ${c.url.pathname}`)).toEqual([
      'POST /api/admin/v1/comments/5/publish',
      'POST /api/admin/v1/comments/5/refuse',
      'POST /api/admin/v1/comments/5/sticky',
      'POST /api/admin/v1/comments/5/unsticky',
      'PUT /api/admin/v1/comments/5/reply',
      'PUT /api/admin/v1/comments/5/reply',
      'POST /api/admin/v1/users/8/block',
      'POST /api/admin/v1/users/8/unblock',
      'POST /api/admin/v1/rebuilds',
    ]);
    expect(JSON.parse(String(calls[4]!.init.body))).toEqual({ body: 'Thanks\nfor this' });
    expect(JSON.parse(String(calls[5]!.init.body))).toEqual({ body: '' });
  });

  it('turn refusals and outages into notices', async () => {
    expect(await runAction(ctxWith(() => json({ error: 'not_found' }, 404)).ctx, 'publish', '5', form())).toBe('not_found');
    expect(await runAction(ctxWith(() => json({ error: 'not_published' }, 409)).ctx, 'sticky', '5', form())).toBe('not_published');
    expect(await runAction(ctxWith(() => json({}, 503)).ctx, 'publish', '5', form())).toBe('unavailable');
  });

  it('refuse a bad id without calling the service', async () => {
    const { ctx, calls } = ctxWith(() => json({}));
    expect(await runAction(ctx, 'publish', 'abc', form())).toBe('invalid');
    expect(await runAction(ctx, 'publish', '-1', form())).toBe('invalid');
    expect(calls).toHaveLength(0);
  });

  it('go back to the same tab and filters, dropping anything else', () => {
    const ctx = createContext(config(), sites);
    expect(backTo(ctx, 'status=pending&site=simplygoodfood', 'published')).toBe('/comments?status=pending&site=simplygoodfood&notice=published');
    expect(backTo(ctx, 'status=refused&path=%2Fa%2F&evil=1', 'refused')).toBe('/comments?status=refused&path=%2Fa%2F&notice=refused');
    expect(backTo(ctx, 'site=unknown', 'x')).toBe('/comments?status=pending&notice=x');
    expect(backTo(ctx, null, 'x')).toBe('/comments?status=pending&notice=x');
  });
});
