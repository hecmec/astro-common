import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { parseSites } from '../src/lib/sites.ts';
import { sites } from './helpers.ts';

describe('console sites', () => {
  it('are exactly the sites of the comments service', () => {
    const comments = parse(readFileSync(resolve(import.meta.dirname, '../../comments/sites.yaml'), 'utf8')) as { sites: Record<string, unknown> };
    expect(sites.map((s) => s.id).sort()).toEqual(Object.keys(comments.sites).sort());
  });

  it('have a name, colours, a domain and an Umami id each', () => {
    expect(sites).toHaveLength(4);
    for (const s of sites) {
      expect(s.name).not.toBe('');
      expect(s.color.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.umamiId).toMatch(/^[0-9a-f-]{36}$/);
      expect(s.searchConsole).toMatch(/^sc-domain:/);
    }
    expect(sites.find((s) => s.id === 'alt-web')).toMatchObject({ domain: 'www.alt-web.org', staging: 'alt-web-staging.babelcoach.com', umamiId: 'c75ecd49-004b-4d68-a67a-f72d5d5d367d' });
  });

  it('have production and staging hosts that the comments service allows', () => {
    const comments = parse(readFileSync(resolve(import.meta.dirname, '../../comments/sites.yaml'), 'utf8')) as { sites: Record<string, { domains: string[] }> };
    for (const s of sites) {
      expect(comments.sites[s.id]!.domains, s.id).toContain(s.domain);
      expect(comments.sites[s.id]!.domains, s.id).toContain(s.staging);
      expect(s.staging).toMatch(/-staging\.babelcoach\.com$/);
    }
  });

  it('reject an invalid file with every problem', () => {
    expect(() => parseSites('sites:\n  x:\n    name: X\n    short: X\n    domain: nope\n    color: { light: red, dark: "#000000" }\n    umami: 1\n')).toThrow(
      /domain[\s\S]*color\.light[\s\S]*umami/,
    );
  });
});
