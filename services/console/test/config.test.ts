import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/lib/config.ts';

const PROD = {
  NODE_ENV: 'production',
  CONSOLE_URL: 'https://console.babelcoach.com/',
  COMMENTS_API_URL: 'https://comments.babelcoach.com',
  CONSOLE_TOKEN: 'c'.repeat(40),
  SESSION_SECRET: 's'.repeat(40),
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  ADMIN_EMAILS: ' Admin@Example.org , other@example.org ',
  UMAMI_URL: 'https://stats.babelcoach.com/',
  UMAMI_USERNAME: 'console',
  UMAMI_PASSWORD: 'pw',
};

describe('console configuration', () => {
  it('reads a complete production configuration', () => {
    const c = loadConfig(PROD);
    expect(c).toMatchObject({
      consoleUrl: 'https://console.babelcoach.com',
      commentsApiUrl: 'https://comments.babelcoach.com',
      adminEmails: ['admin@example.org', 'other@example.org'],
      umami: { url: 'https://stats.babelcoach.com', username: 'console', password: 'pw' },
      google: { clientId: 'id', clientSecret: 'secret' },
      production: true,
      devMode: false,
    });
  });

  it('lists every missing or invalid production value', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      /CONSOLE_URL must be an https URL[\s\S]*COMMENTS_API_URL[\s\S]*CONSOLE_TOKEN is required[\s\S]*SESSION_SECRET is required[\s\S]*GOOGLE_CLIENT_ID[\s\S]*ADMIN_EMAILS is required/,
    );
    expect(() => loadConfig({ ...PROD, CONSOLE_TOKEN: 'short' })).toThrow('CONSOLE_TOKEN is required');
    expect(() => loadConfig({ ...PROD, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET is required');
  });

  it('refuses DEV_MODE in production', () => {
    expect(() => loadConfig({ ...PROD, DEV_MODE: 'true' })).toThrow('DEV_MODE is not allowed in production');
  });

  it('refuses an invalid admin email and a half Umami setting', () => {
    expect(() => loadConfig({ ADMIN_EMAILS: 'admin@example.org,nobody' })).toThrow('"nobody" is not an email address');
    expect(() => loadConfig({ UMAMI_URL: 'https://stats.test' })).toThrow('UMAMI_URL needs UMAMI_USERNAME and UMAMI_PASSWORD');
  });

  it('has development defaults: localhost, a random session secret, visits and Google off', () => {
    const a = loadConfig({ DEV_MODE: 'true' });
    expect(a).toMatchObject({ consoleUrl: 'http://localhost:4340', commentsApiUrl: 'http://localhost:4330', consoleToken: '', devMode: true, umami: undefined, google: undefined });
    expect(a.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(loadConfig({}).sessionSecret).not.toBe(a.sessionSecret);
  });
});
