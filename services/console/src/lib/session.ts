import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'bc_console';
export const OAUTH_COOKIE = 'bc_console_oauth';
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_TTL = 10 * 60 * 1000;

const mac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** `<base64url(JSON payload)>.<HMAC-SHA256>`; the payload carries its expiry `x` (ms). */
export function sign(secret: string, data: Record<string, unknown>, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, x: expiresAt })).toString('base64url');
  return `${payload}.${mac(secret, payload)}`;
}

/** The payload of a value signed with `secret` and not expired, else undefined. */
export function verify<T extends Record<string, unknown>>(secret: string, value: string | undefined, now: number): (T & { x: number }) | undefined {
  if (!value) return undefined;
  const dot = value.indexOf('.');
  if (dot < 1) return undefined;
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(secret, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T & { x: number };
    return typeof data.x === 'number' && data.x > now ? data : undefined;
  } catch {
    return undefined;
  }
}

export function sessionValue(secret: string, email: string, now: number): string {
  return sign(secret, { e: email }, now + SESSION_TTL);
}

/** The signed-in email, if the cookie is valid and the email is still on the admin list. */
export function sessionEmail(secret: string, value: string | undefined, adminEmails: string[], now: number): string | undefined {
  const data = verify<{ e: unknown }>(secret, value, now);
  return typeof data?.e === 'string' && adminEmails.includes(data.e) ? data.e : undefined;
}

export function cookieOptions(production: boolean, maxAgeMs: number) {
  return { path: '/', httpOnly: true, secure: production, sameSite: 'lax' as const, maxAge: Math.floor(maxAgeMs / 1000) };
}

/** A local path to return to after sign-in; anything else becomes /comments. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return '/comments';
  if (value.startsWith('/login') || value.startsWith('/auth/')) return '/comments';
  return value;
}
