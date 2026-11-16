import { describe, expect, it } from 'vitest';
import { guard } from '../src/lib/guard.ts';

const base = { search: '', origin: null, signedIn: false, consoleUrl: 'https://console.test' };

describe('request guard', () => {
  it('sends a visitor to sign-in, keeping the page asked for', () => {
    expect(guard({ ...base, method: 'GET', pathname: '/visits', search: '?range=90' })).toEqual({ kind: 'login', to: '/login?next=%2Fvisits%3Frange%3D90' });
  });

  it('lets the public paths through without sign-in', () => {
    for (const pathname of ['/healthz', '/login', '/auth/google', '/auth/google/callback', '/_astro/x.css', '/favicon.svg']) {
      expect(guard({ ...base, method: 'GET', pathname })).toEqual({ kind: 'pass' });
    }
  });

  it('lets a signed-in admin through', () => {
    expect(guard({ ...base, signedIn: true, method: 'GET', pathname: '/comments' })).toEqual({ kind: 'pass' });
    expect(guard({ ...base, signedIn: true, method: 'POST', pathname: '/comments/1/publish', origin: 'https://console.test' })).toEqual({ kind: 'pass' });
  });

  it('refuses a state-changing request from another site, signed in or not', () => {
    for (const origin of ['https://evil.test', null, 'null', 'http://console.test']) {
      expect(guard({ ...base, signedIn: true, method: 'POST', pathname: '/comments/1/publish', origin }).kind).toBe('forbidden');
    }
    expect(guard({ ...base, method: 'POST', pathname: '/auth/dev', origin: 'https://evil.test' }).kind).toBe('forbidden');
  });

  it('refuses a same-site POST without sign-in instead of redirecting', () => {
    expect(guard({ ...base, method: 'POST', pathname: '/rebuilds', origin: 'https://console.test' })).toEqual({ kind: 'forbidden', reason: 'not signed in' });
  });
});
