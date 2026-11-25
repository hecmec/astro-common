import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageUpdateDates, serializeLastmod } from '../index.js';

function content(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sitemap-dates-'));
  for (const sub of ['items', 'items/fr', 'items/de', 'infos', 'infos/fr']) mkdirSync(join(dir, sub));
  writeFileSync(join(dir, 'items', 'anki.md'), '---\nid: anki\ncreation_date: 2026-10-09\nupdate_date: 2026-10-22\n---\nText\n');
  writeFileSync(join(dir, 'items', 'elllo.md'), '---\nid: elllo\ncreation_date: "2026-10-10"\n---\nText\n');
  writeFileSync(join(dir, 'items', 'undated.md'), '---\nid: undated\n---\nText\n');
  writeFileSync(join(dir, 'items', 'fr', 'anki.md'), '---\nname: Anki\n---\nTexte\n');
  writeFileSync(join(dir, 'items', 'de', 'anki.md'), '---\nname: Anki\n---\nText\n');
  writeFileSync(join(dir, 'items', 'fr', 'elllo.md'), '---\nname: ELLLO\n---\nTexte\n');
  writeFileSync(join(dir, 'infos', 'note.md'), '---\r\nid: note\r\ncreation_date: 2026-10-20\r\nupdate_date: 2026-10-23\r\n---\r\nText\r\n');
  writeFileSync(join(dir, 'infos', 'fr', 'note.md'), '---\nname: Note\n---\nTexte\n');
  return dir;
}

describe('pageUpdateDates', () => {
  it('gives each page its update date, else its creation date, and each translation the date of its page', () => {
    const dates = pageUpdateDates({
      contentDir: content(),
      pages: { items: '/recipes/__id__/', infos: '/infos/__id__/' },
      locales: ['fr', 'de'],
    });
    expect(Object.fromEntries(dates)).toEqual({
      '/recipes/anki/': '2026-10-22',
      '/fr/recipes/anki/': '2026-10-22',
      '/de/recipes/anki/': '2026-10-22',
      '/recipes/elllo/': '2026-10-10',
      '/fr/recipes/elllo/': '2026-10-10',
      '/infos/note/': '2026-10-23',
      '/fr/infos/note/': '2026-10-23',
    });
  });

  it('adds no translated paths without locales', () => {
    const dates = pageUpdateDates({ contentDir: content(), pages: { items: '/ressources/__id__/' } });
    expect([...dates.keys()]).toEqual(['/ressources/anki/', '/ressources/elllo/']);
  });
});

describe('serializeLastmod', () => {
  it('adds lastmod to dated pages only', () => {
    const serialize = serializeLastmod(new Map([['/fr/recipes/anki/', '2026-10-22']]));
    expect(serialize({ url: 'https://example.org/fr/recipes/anki/' })).toEqual({
      url: 'https://example.org/fr/recipes/anki/',
      lastmod: '2026-10-22',
    });
    expect(serialize({ url: 'https://example.org/fr/' })).toEqual({ url: 'https://example.org/fr/' });
  });
});
