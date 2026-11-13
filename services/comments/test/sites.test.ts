import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import { isAllowedOrigin, loadSites, parseSites } from '../src/sites.ts';
import { normalizePath } from '../src/util.ts';
import { SITES_YAML } from './helpers.ts';

describe('sites.yaml', () => {
  it('derives https origins from the allowed domains', () => {
    const sites = parseSites(SITES_YAML, { allowDevOrigins: false });
    const alt = sites.get('alt-web')!;
    expect([...alt.origins]).toEqual(['https://www.alt-web.org', 'https://alt-web-staging.babelcoach.com']);
    expect(alt.bakeAfterDays).toBe(7);
    expect(isAllowedOrigin(sites, 'https://www.simplygoodfood.eu')).toBe(true);
    expect(isAllowedOrigin(sites, 'https://evil.example')).toBe(false);
  });

  it('accepts dev origins only in development', () => {
    expect(parseSites(SITES_YAML, { allowDevOrigins: false }).get('alt-web')!.origins.has('http://localhost:4325')).toBe(false);
    expect(parseSites(SITES_YAML, { allowDevOrigins: true }).get('alt-web')!.origins.has('http://localhost:4325')).toBe(true);
  });

  it('refuses a domain listed for two sites, naming it', () => {
    const yaml = `sites:\n  a: { name: A, domains: [x.example.org] }\n  b: { name: B, domains: [y.example.org, x.example.org] }\n`;
    expect(() => parseSites(yaml, { allowDevOrigins: false })).toThrow(/x\.example\.org.*a.*b/);
  });

  it('refuses invalid entries', () => {
    expect(() => parseSites('sites:\n  a: { name: A, domains: ["https://x.org"] }\n', { allowDevOrigins: false })).toThrow(/host name/);
    expect(() => parseSites('sites:\n  a: { name: A, domains: [] }\n', { allowDevOrigins: false })).toThrow();
    expect(() => parseSites('sites:\n  a: { name: A, domains: [x.org], dev_origins: ["https://x.org"] }\n', { allowDevOrigins: true })).toThrow();
  });

  it('loads the real sites.yaml', () => {
    const sites = loadSites(resolve(import.meta.dirname, '../sites.yaml'), { allowDevOrigins: false });
    expect([...sites.keys()].sort()).toEqual(['alt-web', 'anglais-gratuit', 'bonetgratuit', 'simplygoodfood']);
  });
});

describe('config', () => {
  it('refuses dev settings and missing values in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', BASE_URL: 'https://c.example.org', ADMIN_EMAIL: 'a@b.org', SMTP_URL: 'smtp://x', DEV_MODE: 'true' })).toThrow(/DEV_MODE/);
    expect(() => loadConfig({ NODE_ENV: 'production', BASE_URL: 'http://c.example.org', ADMIN_EMAIL: 'a@b.org', SMTP_URL: 'smtp://x' })).toThrow(/https/);
    expect(loadConfig({ NODE_ENV: 'production', BASE_URL: 'https://c.example.org/', ADMIN_EMAIL: 'A@B.org', SMTP_URL: 'smtp://x' })).toMatchObject({
      baseUrl: 'https://c.example.org',
      adminEmail: 'a@b.org',
      emailSignIn: true,
    });
    // Without SMTP the service starts, with the email sign-in off
    expect(loadConfig({ NODE_ENV: 'production', BASE_URL: 'https://c.example.org', ADMIN_EMAIL: 'a@b.org' })).toMatchObject({ emailSignIn: false });
    expect(loadConfig({})).toMatchObject({ emailSignIn: true }); // development: links printed
  });
});

describe('database', () => {
  it('runs the migrations on an empty database', () => {
    const db = openDb(':memory:');
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(['auth_flows', 'comments', 'login_links', 'meta', 'reactions', 'replies', 'sessions', 'users']);
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2);
    const columns = (db.prepare('PRAGMA table_info(comments)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('sticky');
  });
});

describe('page identity', () => {
  it.each([
    ['/tag/vrac/', '/tag/vrac/'],
    ['/tag/vrac', '/tag/vrac/'],
    ['/tag/vrac/?utm_source=x#top', '/tag/vrac/'],
    ['/fr/x/index.html', '/fr/x/'],
    ['//double//slash/', null],
    ['/a//b/', '/a/b/'],
    ['/feed.xml', '/feed.xml'],
    ['/caf%C3%A9/', '/caf%C3%A9/'],
    ['/café/', '/caf%C3%A9/'],
    ['relative/', null],
    ['/../etc/', null],
    [`/${'a'.repeat(400)}/`, null],
    [42, null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it('keeps language versions apart', () => {
    expect(normalizePath('/fr/x/')).not.toBe(normalizePath('/x/'));
  });
});
