import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearExportCache, fetchExport, normalizePath, renderSection } from '../index.js';
import type { ExportData } from '../index.d.ts';

const API = 'https://comments.test';

const data: ExportData = {
  site: 'alt-web',
  name: 'Alt Web',
  cutoff: '2026-11-06T10:00:00.000Z',
  generated_at: '2026-11-13T10:00:00.000Z',
  reactions: [
    { id: 'useful', icon: '👍', label: { en: 'Useful', fr: 'Utile', de: 'Hilfreich' } },
    { id: 'tried', icon: '✅', label: { en: 'I use it', fr: 'Je l’utilise', de: 'Nutze ich' } },
  ],
  pages: {
    '/tag/vrac/': {
      comments: [
        {
          id: 7,
          author: 'Ana',
          body: 'Great shop.\nSee https://example.org/page. <b>bold</b>',
          created_at: '2026-10-01T09:00:00.000Z',
          published_at: '2026-10-02T09:00:00.000Z',
          reply: { body: 'Thanks!', created_at: '2026-10-03T09:00:00.000Z' },
        },
        { id: 8, author: null, body: 'Kept comment', created_at: '2026-10-04T09:00:00.000Z', published_at: '2026-10-04T10:00:00.000Z', reply: null },
      ],
      reactions: { useful: 3 },
    },
  },
};

describe('renderSection', () => {
  it('bakes the comments of the page, readable without JavaScript', () => {
    const html = renderSection({ site: 'alt-web', api: `${API}/`, path: '/tag/vrac', lang: 'en', data });
    expect(html).toContain('<h2 id="bc-comments-heading">Your reactions, your comments</h2>');
    expect(html).toContain('<strong>Ana</strong> <time datetime="2026-10-02T09:00:00.000Z">Oct 2, 2026</time>');
    expect(html).toContain('Great shop.<br>See <a href="https://example.org/page" rel="nofollow ugc noopener" target="_blank">https://example.org/page</a>.');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('<strong>Reply from Alt Web</strong><p>Thanks!</p>');
    expect(html).toContain('<strong>Former reader</strong>');
    expect(html).toContain('Useful <strong>3</strong>');
    expect(html).not.toContain('I use it'); // no count, not shown
    expect(html).toContain(`data-site="alt-web" data-api="${API}" data-cutoff="2026-11-06T10:00:00.000Z" data-heading="false"`);
    expect(html).toContain(`<script src="${API}/widget.js" defer></script>`);
    // most recent first: the widget (form, newer comments) comes before the baked, older ones
    expect(html.indexOf('data-bc-comments')).toBeLessThan(html.indexOf('data-bc-baked'));
  });

  it('uses the page language', () => {
    const html = renderSection({ site: 'alt-web', api: API, path: '/tag/vrac/', lang: 'fr-FR', data });
    expect(html).toContain('Vos réactions, vos commentaires');
    expect(html).toContain('Réponse de Alt Web');
    expect(html).toContain('Ancien lecteur');
    expect(html).toContain('2 oct. 2026');
    expect(html).toContain('Utile <strong>3</strong>');
  });

  it('renders an empty section for other pages', () => {
    const html = renderSection({ site: 'alt-web', api: API, path: '/fr/tag/vrac/', lang: 'fr', data });
    expect(html).toContain('<div class="bc-baked" data-bc-baked></div>');
    expect(html).toContain('data-cutoff=');
  });

  it('leaves out the cutoff when the export failed, so the widget loads everything', () => {
    const html = renderSection({ site: 'alt-web', api: API, path: '/tag/vrac/', data: null });
    expect(html).not.toContain('data-cutoff');
    expect(html).toContain('<div class="bc-baked" data-bc-baked></div>');
  });

  it('escapes attributes', () => {
    const html = renderSection({ site: 'a"b', api: API, path: '/', data: null });
    expect(html).toContain('data-site="a&quot;b"');
  });
});

describe('normalizePath', () => {
  it('matches the service page identity', () => {
    expect(normalizePath('/tag/vrac')).toBe('/tag/vrac/');
    expect(normalizePath('/fr/x/index.html')).toBe('/fr/x/');
    expect(normalizePath('/café/')).toBe('/caf%C3%A9/');
    expect(normalizePath('/caf%C3%A9/')).toBe('/caf%C3%A9/');
  });
});

describe('fetchExport', () => {
  beforeEach(() => clearExportCache());

  it('fetches once per build and site', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(data)));
    const a = await fetchExport(API, 'alt-web', { fetch: fetchMock });
    const b = await fetchExport(API, 'alt-web', { fetch: fetchMock });
    expect(a).toEqual(data);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/api/v1/sites/alt-web/export`, expect.anything());
  });

  it('resolves to null with a warning when the service fails', async () => {
    const logger = { warn: vi.fn() };
    const res = await fetchExport(API, 'alt-web', { fetch: async () => new Response('nope', { status: 503 }), logger });
    expect(res).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 503'));
  });

  it('resolves to null on an invalid response', async () => {
    const logger = { warn: vi.fn() };
    expect(await fetchExport(API, 'alt-web', { fetch: async () => new Response('{"hello":1}'), logger })).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unexpected response'));
  });

  it('gives up after the timeout', async () => {
    const logger = { warn: vi.fn() };
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
    const started = Date.now();
    expect(await fetchExport(API, 'alt-web', { fetch: hanging, timeout: 100, logger })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(logger.warn).toHaveBeenCalled();
  });
});
