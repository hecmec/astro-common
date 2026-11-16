import { describe, expect, it } from 'vitest';
import { SESSION_TTL, cookieOptions, safeNext, sessionEmail, sessionValue, sign, verify } from '../src/lib/session.ts';

const SECRET = 's'.repeat(40);
const ADMINS = ['admin@example.org'];
const NOW = Date.parse('2026-11-16T10:00:00Z');

describe('session cookie', () => {
  it('holds the email for 30 days', () => {
    const v = sessionValue(SECRET, 'admin@example.org', NOW);
    expect(sessionEmail(SECRET, v, ADMINS, NOW)).toBe('admin@example.org');
    expect(sessionEmail(SECRET, v, ADMINS, NOW + SESSION_TTL - 1)).toBe('admin@example.org');
    expect(sessionEmail(SECRET, v, ADMINS, NOW + SESSION_TTL)).toBeUndefined();
  });

  it('is refused when altered', () => {
    const v = sessionValue(SECRET, 'admin@example.org', NOW);
    const [payload, mac] = v.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ e: 'admin@example.org', x: NOW + 10 * SESSION_TTL })).toString('base64url');
    expect(sessionEmail(SECRET, `${forged}.${mac}`, ADMINS, NOW)).toBeUndefined();
    expect(sessionEmail(SECRET, `${payload}.${mac.slice(0, -2)}xx`, ADMINS, NOW)).toBeUndefined();
    expect(sessionEmail(SECRET, payload, ADMINS, NOW)).toBeUndefined();
    expect(sessionEmail(SECRET, 'garbage', ADMINS, NOW)).toBeUndefined();
  });

  it('is refused under another secret (rotation signs everyone out)', () => {
    const v = sessionValue(SECRET, 'admin@example.org', NOW);
    expect(sessionEmail('o'.repeat(40), v, ADMINS, NOW)).toBeUndefined();
  });

  it('is refused once the email leaves the admin list', () => {
    const v = sessionValue(SECRET, 'admin@example.org', NOW);
    expect(sessionEmail(SECRET, v, ['other@example.org'], NOW)).toBeUndefined();
  });

  it('signs any payload with an expiry', () => {
    const v = sign(SECRET, { s: 'state' }, NOW + 1000);
    expect(verify(SECRET, v, NOW)).toMatchObject({ s: 'state' });
    expect(verify(SECRET, v, NOW + 1000)).toBeUndefined();
  });

  it('is HttpOnly, Lax, and Secure in production', () => {
    expect(cookieOptions(true, SESSION_TTL)).toEqual({ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 });
    expect(cookieOptions(false, 1000).secure).toBe(false);
  });
});

describe('return path after sign-in', () => {
  it('keeps local paths and refuses the rest', () => {
    expect(safeNext('/visits?range=90')).toBe('/visits?range=90');
    for (const bad of [null, '', 'https://evil.test/', '//evil.test/', '/\\evil.test', '/login?next=/x', '/auth/google', '/a\r\nSet-Cookie: x']) {
      expect(safeNext(bad)).toBe('/comments');
    }
  });
});
