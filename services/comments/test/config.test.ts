import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

const PROD = { NODE_ENV: 'production', BASE_URL: 'https://comments.test', ADMIN_EMAIL: 'admin@example.org' };
const TOKEN = 'x'.repeat(40);

describe('console settings', () => {
  it('leave the admin API off without CONSOLE_TOKEN', () => {
    const c = loadConfig({});
    expect(c.consoleToken).toBeUndefined();
    expect(c.consoleUrl).toBeUndefined();
  });

  it('read CONSOLE_TOKEN and CONSOLE_URL without trailing slash', () => {
    const c = loadConfig({ ...PROD, CONSOLE_TOKEN: ` ${TOKEN} `, CONSOLE_URL: 'https://console.test/' });
    expect(c.consoleToken).toBe(TOKEN);
    expect(c.consoleUrl).toBe('https://console.test');
  });

  it('refuse an http CONSOLE_URL in production, accept it in development', () => {
    expect(() => loadConfig({ ...PROD, CONSOLE_URL: 'http://console.test' })).toThrow('CONSOLE_URL must be an https URL');
    expect(loadConfig({ CONSOLE_URL: 'http://localhost:4340' }).consoleUrl).toBe('http://localhost:4340');
  });

  it('refuse a short CONSOLE_TOKEN in production', () => {
    expect(() => loadConfig({ ...PROD, CONSOLE_TOKEN: 'short' })).toThrow('CONSOLE_TOKEN must be at least 32 characters');
  });
});
