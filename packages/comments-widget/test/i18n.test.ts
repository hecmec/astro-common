import { describe, expect, it } from 'vitest';
import { strings, translator } from '../src/i18n.ts';

describe('widget strings', () => {
  it('have the same keys in English, French and German', () => {
    const en = Object.keys(strings.en).sort();
    expect(Object.keys(strings.fr).sort()).toEqual(en);
    expect(Object.keys(strings.de).sort()).toEqual(en);
  });

  it('fill in variables', () => {
    expect(translator('fr')('replyFrom', { site: 'Alt Web' })).toBe('Réponse de Alt Web');
    expect(translator('en')('tooLong', { max: 2000 })).toBe('Comments are limited to 2000 characters.');
  });

  it('use the requested section heading', () => {
    expect(strings.en.heading).toBe('Your reactions, your comments');
    expect(strings.fr.heading).toBe('Vos réactions, vos commentaires');
  });
});
