import { type GoogleProvider, pkceChallenge, randomToken } from '@babelcoach/google-auth';
import type { ConsoleConfig } from './config.ts';
import { OAUTH_TTL, safeNext, sign, verify } from './session.ts';

export interface AuthDeps {
  config: ConsoleConfig;
  google: GoogleProvider | undefined;
  now: () => number;
}

export const redirectUri = (config: ConsoleConfig) => `${config.consoleUrl}/auth/google/callback`;

export function isAdmin(config: ConsoleConfig, email: string): boolean {
  return config.adminEmails.includes(email.trim().toLowerCase());
}

export type SignInError = 'expired' | 'google' | 'unverified' | 'refused' | 'google_off';

/** Message and status of the sign-in page for each failure (spec admin-console). */
export function signInError(code: string | null, email: string | null): { status: number; message: string } | undefined {
  const who = email?.trim() || 'this account';
  switch (code) {
    case 'refused':
      return { status: 403, message: `Access refused for ${who}: this account is not on the console's admin list.` };
    case 'unverified':
      return { status: 403, message: `The Google account ${who} has no verified email address.` };
    case 'expired':
      return { status: 400, message: 'This sign-in has expired or did not start here. Please sign in again.' };
    case 'google':
      return { status: 502, message: 'Google sign-in failed. Please try again.' };
    case 'google_off':
      return { status: 503, message: 'Google sign-in is not configured.' };
    default:
      return undefined;
  }
}

/** Starts a Google sign-in: the redirect to Google and the signed state/verifier cookie. */
export function startGoogle(deps: AuthDeps, next: string | null): { redirect: string; cookie: string } | undefined {
  if (!deps.google) return undefined;
  const state = randomToken();
  const verifier = randomToken(48);
  const cookie = sign(deps.config.sessionSecret, { s: state, v: verifier, n: safeNext(next) }, deps.now() + OAUTH_TTL);
  return { redirect: deps.google.authorizationUrl({ state, codeChallenge: pkceChallenge(verifier), redirectUri: redirectUri(deps.config) }), cookie };
}

export type SignInResult = { ok: true; email: string; next: string } | { ok: false; error: SignInError; email?: string };

/** Google's callback: checks the state against the cookie, exchanges the code, checks the allow-list. */
export async function finishGoogle(deps: AuthDeps, p: { state: string | null; code: string | null; cookie: string | undefined }): Promise<SignInResult> {
  const flow = verify<{ s: unknown; v: unknown; n: unknown }>(deps.config.sessionSecret, p.cookie, deps.now());
  if (!deps.google || !flow || typeof flow.s !== 'string' || typeof flow.v !== 'string' || !p.state || p.state !== flow.s) {
    return { ok: false, error: 'expired' };
  }
  if (!p.code) return { ok: false, error: 'google' };
  let profile;
  try {
    profile = await deps.google.exchange({ code: p.code, codeVerifier: flow.v, redirectUri: redirectUri(deps.config) });
  } catch (err) {
    console.error('Google sign-in failed:', err);
    return { ok: false, error: 'google' };
  }
  if (!profile.email_verified) return { ok: false, error: 'unverified', email: profile.email };
  if (!isAdmin(deps.config, profile.email)) return { ok: false, error: 'refused', email: profile.email };
  return { ok: true, email: profile.email, next: safeNext(typeof flow.n === 'string' ? flow.n : null) };
}

/** Development sign-in without Google (DEV_MODE, never in production); still limited to the admin list. */
export function devSignIn(config: ConsoleConfig, email: string, next: string | null): SignInResult | undefined {
  if (!config.devMode || config.production) return undefined;
  const e = email.trim().toLowerCase();
  if (!isAdmin(config, e)) return { ok: false, error: 'refused', email: e };
  return { ok: true, email: e, next: safeNext(next) };
}
