import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TOKEN_URL, USERINFO_URL, googleProvider, pkceChallenge, randomToken } from '../src/index.ts';

type Call = { url: string; init?: RequestInit };

function fakeFetch(answers: Record<string, () => Response>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const answer = answers[url];
    if (!answer) throw new Error(`unexpected fetch ${url}`);
    return answer();
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('pkce', () => {
  it('computes the S256 challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    // RFC 7636 appendix B
    expect(pkceChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(pkceChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('makes distinct url-safe tokens', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe('googleProvider', () => {
  it('builds the authorization URL with PKCE and state', () => {
    const url = new URL(googleProvider('cid', 'secret').authorizationUrl({ state: 's1', codeChallenge: 'ch', redirectUri: 'https://x.test/cb' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cid',
      redirect_uri: 'https://x.test/cb',
      response_type: 'code',
      scope: 'openid email profile',
      state: 's1',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
  });

  it('exchanges the code and returns the verified profile with a lowercased email', async () => {
    const f = fakeFetch({
      [TOKEN_URL]: json({ access_token: 'at' }),
      [USERINFO_URL]: json({ sub: 'g1', email: 'Ana@Gmail.com', email_verified: true, name: 'Ana' }),
    });
    const profile = await googleProvider('cid', 'secret', f.impl).exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'https://x.test/cb' });
    expect(profile).toEqual({ sub: 'g1', email: 'ana@gmail.com', email_verified: true, name: 'Ana' });
    const body = new URLSearchParams(String(f.calls[0]!.init!.body));
    expect(Object.fromEntries(body)).toMatchObject({ code: 'c', code_verifier: 'v', client_secret: 'secret', grant_type: 'authorization_code' });
    expect(new Headers(f.calls[1]!.init!.headers).get('authorization')).toBe('Bearer at');
  });

  it('reports an unverified email', async () => {
    const f = fakeFetch({ [TOKEN_URL]: json({ access_token: 'at' }), [USERINFO_URL]: json({ sub: 'g1', email: 'a@b.c', email_verified: 'false' }) });
    const profile = await googleProvider('cid', 'secret', f.impl).exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r' });
    expect(profile.email_verified).toBe(false);
  });

  it('fails on token errors and incomplete profiles', async () => {
    const p1 = googleProvider('cid', 'secret', fakeFetch({ [TOKEN_URL]: json({ error: 'invalid_grant' }, 400) }).impl);
    await expect(p1.exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })).rejects.toThrow('400');
    const p2 = googleProvider('cid', 'secret', fakeFetch({ [TOKEN_URL]: json({}) }).impl);
    await expect(p2.exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })).rejects.toThrow('no access token');
    const p3 = googleProvider('cid', 'secret', fakeFetch({ [TOKEN_URL]: json({ access_token: 'at' }), [USERINFO_URL]: json({ email: 'a@b.c' }) }).impl);
    await expect(p3.exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })).rejects.toThrow('incomplete');
  });
});
