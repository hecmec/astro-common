import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import CommentCard from '../src/components/CommentCard.astro';
import RebuildBox from '../src/components/RebuildBox.astro';
import type { AdminComment } from '../src/lib/comments-api.ts';
import { sites } from './helpers.ts';

const alt = sites.find((s) => s.id === 'alt-web')!;
const comment = (over: Partial<AdminComment> = {}): AdminComment => ({
  id: 7,
  site: 'alt-web',
  path: '/alternatives/fairphone/',
  url: 'https://www.alt-web.org/alternatives/fairphone/',
  lang: 'en',
  status: 'pending',
  created_at: '2026-11-16T13:02:00.000Z',
  published_at: null,
  author: 'Anna',
  email: 'anna@example.org',
  user_id: 3,
  blocked: false,
  sticky: false,
  body: 'Is the battery <b>easy</b> to replace?',
  reply: null,
  ...over,
});

async function render(component: Parameters<AstroContainer['renderToString']>[0], props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(component, { props });
}

describe('comment card', () => {
  it('shows site, page link, language, Paris time, author and email, with escaped text', async () => {
    const html = await render(CommentCard, { comment: comment(), site: alt, back: 'status=pending&site=alt-web' });
    expect(html).toContain('data-site="alt-web"');
    expect(html).toContain('background: var(--site-alt-web)');
    expect(html).toContain('href="https://www.alt-web.org/alternatives/fairphone/"');
    expect(html).toContain('16 Nov 2026, 14:02');
    expect(html).toContain('Anna');
    expect(html).toContain('&lt;anna@example.org&gt;');
    expect(html).toContain('&lt;b&gt;easy&lt;/b&gt;');
    expect(html).not.toContain('<b>easy</b>');
  });

  it('offers publish, refuse and block on a pending comment, each coming back to the list', async () => {
    const html = await render(CommentCard, { comment: comment(), site: alt, back: 'status=pending&site=alt-web' });
    expect(html).toContain('action="/comments/7/publish"');
    expect(html).toContain('action="/comments/7/refuse"');
    expect(html).toContain('action="/users/3/block"');
    expect(html).not.toContain('/sticky"');
    expect(html).not.toContain('action="/comments/7/reply"');
    expect(html.match(/name="back" value="status=pending&amp;site=alt-web"/g)).toHaveLength(3);
  });

  it('offers sticky, unpublish and the reply on a published comment', async () => {
    const html = await render(CommentCard, { comment: comment({ status: 'published', sticky: true, reply: { body: 'Thanks', created_at: null }, blocked: true }), site: alt, back: '' });
    expect(html).not.toContain('/publish"');
    expect(html).toContain('action="/comments/7/unsticky"');
    expect(html).toContain('Unpublish');
    expect(html).toContain('action="/comments/7/reply"');
    expect(html).toContain('>Thanks</textarea>');
    expect(html).toContain('action="/users/3/unblock"');
    expect(html).toContain('>blocked<');
    expect(html).toContain('>sticky<');
  });

  it('shows a deleted account as a former reader, without block button', async () => {
    const html = await render(CommentCard, { comment: comment({ author: null, email: null, user_id: null }), site: alt, back: '' });
    expect(html).toContain('Former reader');
    expect(html).not.toContain('/users/');
  });
});

describe('rebuild box', () => {
  it('shows each site and the button', async () => {
    const html = await render(RebuildBox, {
      back: 'status=pending',
      rebuilds: {
        enabled: true,
        at: '03:30',
        timezone: 'Europe/Paris',
        sites: [
          { id: 'alt-web', name: 'Alt Web', status: { checked_at: '2026-11-16T02:30:00.000Z', result: 'requested' } },
          { id: 'simplygoodfood', name: 'Simply Good Food', status: { checked_at: '2026-11-16T02:30:00.000Z', result: 'failed', error: 'Coolify answered 500' } },
          { id: 'bonetgratuit', name: 'Bon et gratuit', status: null },
        ],
      },
    });
    expect(html).toContain('Rebuild changed sites now');
    expect(html).toContain('action="/rebuilds"');
    expect(html).toContain('Every night at 03:30 (Europe/Paris)');
    expect(html).toContain('Alt Web: 16 Nov 2026, 03:30 · rebuild requested');
    expect(html).toContain('failed: Coolify answered 500');
    expect(html).toContain('Bon et gratuit: never checked');
  });

  it('says rebuilds are off, without a button', async () => {
    const html = await render(RebuildBox, { back: '', rebuilds: { enabled: false } });
    expect(html).toContain('data-rebuilds-off');
    expect(html).not.toContain('Rebuild changed sites now');
  });

  it('says the status is unavailable when the service is down', async () => {
    expect(await render(RebuildBox, { back: '', rebuilds: null })).toContain('status unavailable');
  });
});
