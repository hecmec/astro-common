import type { GoogleProfile, GoogleProvider } from '@babelcoach/google-auth';
import { describe, expect, it } from 'vitest';
import { devSignIn, finishGoogle, signInError, startGoogle } from '../src/lib/auth.ts';
import { config } from './helpers.ts';

const NOW = Date.parse('2026-11-16T10:00:00Z');

function fakeGoogle(profile: GoogleProfile | Error) {
  const exchanges: { code: string; codeVerifier: string; redirectUri: string }[] = [];
  const google: GoogleProvider = {
    authorizationUrl: ({ state, codeChallenge, redirectUri }) => `https://accounts.google.test/auth?${new URLSearchParams({ state, codeChallenge, redirectUri })}`,
    exchange: async (p) => {
      exchanges.push(p);
      if (profile instanceof Error) throw profile;
      return profile;
    },
  };
  return { google, exchanges };
}

async function signIn(profile: GoogleProfile | Error, opts: { next?: string; now?: number; tamperState?: boolean } = {}) {
  const { google, exchanges } = fakeGoogle(profile);
  const deps = { config: config(), google, now: () => NOW };
  const start = startGoogle(deps, opts.next ?? '/visits?range=90')!;
  const url = new URL(start.redirect);
  const state = opts.tamperState ? 'other' : url.searchParams.get('state');
  const result = await finishGoogle({ ...deps, now: () => opts.now ?? NOW }, { state, code: 'the-code', cookie: start.cookie });
  return { result, url, exchanges };
}

const ADMIN: GoogleProfile = { sub: 'g1', email: 'admin@example.org', email_verified: true };

describe('Google sign-in', () => {
  it('lets an admin in and returns to the requested page', async () => {
    const { result, url, exchanges } = await signIn(ADMIN);
    expect(result).toEqual({ ok: true, email: 'admin@example.org', next: '/visits?range=90' });
    expect(url.searchParams.get('redirectUri')).toBe('https://console.test/auth/google/callback');
    expect(exchanges[0]).toMatchObject({ code: 'the-code', redirectUri: 'https://console.test/auth/google/callback' });
    expect(exchanges[0]!.codeVerifier.length).toBeGreaterThan(40);
  });

  it('refuses another account, naming it', async () => {
    const { result } = await signIn({ sub: 'g2', email: 'stranger@example.org', email_verified: true });
    expect(result).toEqual({ ok: false, error: 'refused', email: 'stranger@example.org' });
    expect(signInError('refused', 'stranger@example.org')).toEqual({
      status: 403,
      message: "Access refused for stranger@example.org: this account is not on the console's admin list.",
    });
  });

  it('refuses an unverified email', async () => {
    expect((await signIn({ ...ADMIN, email_verified: false })).result).toMatchObject({ ok: false, error: 'unverified' });
  });

  it('refuses a callback whose state does not match, or after 10 minutes', async () => {
    expect((await signIn(ADMIN, { tamperState: true })).result).toEqual({ ok: false, error: 'expired' });
    expect((await signIn(ADMIN, { now: NOW + 10 * 60 * 1000 })).result).toEqual({ ok: false, error: 'expired' });
    const deps = { config: config(), google: fakeGoogle(ADMIN).google, now: () => NOW };
    expect(await finishGoogle(deps, { state: 'x', code: 'c', cookie: undefined })).toEqual({ ok: false, error: 'expired' });
  });

  it('reports a failed exchange', async () => {
    expect((await signIn(new Error('boom'))).result).toEqual({ ok: false, error: 'google' });
  });

  it('never returns to a foreign site', async () => {
    expect((await signIn(ADMIN, { next: 'https://evil.test/' })).result).toMatchObject({ ok: true, next: '/comments' });
  });

  it('is off without a Google client', () => {
    expect(startGoogle({ config: config(), google: undefined, now: () => NOW }, null)).toBeUndefined();
  });
});

describe('dev sign-in', () => {
  it('works only in DEV_MODE outside production, for admins', () => {
    expect(devSignIn(config(), 'admin@example.org', null)).toBeUndefined();
    expect(devSignIn(config({ devMode: true, production: true }), 'admin@example.org', null)).toBeUndefined();
    expect(devSignIn(config({ devMode: true }), ' Admin@Example.org ', '/visits')).toEqual({ ok: true, email: 'admin@example.org', next: '/visits' });
    expect(devSignIn(config({ devMode: true }), 'x@example.org', null)).toEqual({ ok: false, error: 'refused', email: 'x@example.org' });
  });
});
