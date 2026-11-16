import { createHash, randomBytes } from 'node:crypto';

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

export interface GoogleProvider {
  authorizationUrl(p: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchange(p: { code: string; codeVerifier: string; redirectUri: string }): Promise<GoogleProfile>;
}

export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** A random URL-safe token (state, PKCE verifier). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** PKCE S256 challenge of a verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Google sign-in, authorization code flow with PKCE. The profile is read from the
 * userinfo endpoint with the access token, so no ID token has to be verified: the
 * TLS connection to Google authenticates the answer (OIDC Core 3.1.3.7).
 * `fetchImpl` is for tests.
 */
export function googleProvider(clientId: string, clientSecret: string, fetchImpl: typeof fetch = fetch): GoogleProvider {
  return {
    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return url.toString();
    },

    async exchange({ code, codeVerifier, redirectUri }) {
      const tokenRes = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) throw new Error(`Google token endpoint answered ${tokenRes.status}`);
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) throw new Error('Google returned no access token');

      const infoRes = await fetchImpl(USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!infoRes.ok) throw new Error(`Google userinfo endpoint answered ${infoRes.status}`);
      const info = (await infoRes.json()) as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown };
      if (typeof info.sub !== 'string' || typeof info.email !== 'string') throw new Error('Google returned an incomplete profile');
      return {
        sub: info.sub,
        email: info.email.toLowerCase(),
        email_verified: info.email_verified === true || info.email_verified === 'true',
        name: typeof info.name === 'string' ? info.name : undefined,
      };
    },
  };
}
