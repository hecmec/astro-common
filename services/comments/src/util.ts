import { createHash, randomBytes } from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Normalises a page path: removes index.html, collapses repeated slashes and
 * adds a missing trailing slash. Returns null for anything that is not a path.
 */
export function normalizePath(input: unknown): string | null {
  if (typeof input !== 'string' || !input.startsWith('/') || input.startsWith('//')) return null;
  let path = input.split(/[?#]/, 1)[0]!;
  try {
    path = encodeURI(decodeURI(path));
  } catch {
    return null;
  }
  path = path.replace(/\/{2,}/g, '/').replace(/\/index\.html?$/i, '/');
  if (!path.endsWith('/') && !/\.[a-z0-9]{1,5}$/i.test(path)) path += '/';
  if (path.length > 300 || path.includes('/../') || path.includes('/./')) return null;
  return path;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type Clock = () => number;
export const systemClock: Clock = () => Date.now();

export function iso(ms: number | null | undefined): string | null {
  return ms == null ? null : new Date(ms).toISOString();
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$/;
