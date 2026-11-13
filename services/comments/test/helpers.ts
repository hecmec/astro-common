import { createApp } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import type { GoogleProfile, GoogleProvider } from '../src/google.ts';
import { MemoryMailer } from '../src/mailer.ts';
import { parseSites } from '../src/sites.ts';
import { createSession, findOrCreateUser, setDisplayName } from '../src/store.ts';

export const BASE = 'https://comments.test';
export const ALT = 'https://www.alt-web.org';
export const SGF = 'https://www.simplygoodfood.eu';
export const ADMIN = 'admin@example.org';

export const SITES_YAML = `
sites:
  alt-web:
    name: Alt Web
    domains: [www.alt-web.org, alt-web-staging.babelcoach.com]
    dev_origins: [http://localhost:4325]
    bake_after_days: 7
    reactions:
      - { id: useful, icon: "👍", label: { en: Useful, fr: Utile, de: Hilfreich } }
      - { id: tried, icon: "✅", label: { en: I use it, fr: Je l’utilise, de: Nutze ich } }
  simplygoodfood:
    name: Simply Good Food
    domains: [www.simplygoodfood.eu]
    bake_after_days: 3
`;

export function setup(opts: { google?: GoogleProfile | Error; devMode?: boolean; emailSignIn?: boolean } = {}) {
  let time = Date.parse('2026-11-01T10:00:00Z');
  const now = () => time;
  const advance = (ms: number) => {
    time += ms;
  };
  const config: Config = {
    baseUrl: BASE,
    adminEmail: ADMIN,
    mailFrom: 'test@comments.test',
    emailSignIn: opts.emailSignIn ?? true,
    databasePath: ':memory:',
    sitesFile: '',
    allowDevOrigins: false,
    devMode: opts.devMode ?? false,
    trustProxy: true,
    port: 0,
    production: false,
  };
  const sites = parseSites(SITES_YAML, { allowDevOrigins: false });
  const db = openDb(':memory:');
  const mailer = new MemoryMailer();
  let google: GoogleProvider | undefined;
  if (opts.google) {
    const profile = opts.google;
    google = {
      authorizationUrl: ({ state }) => `https://accounts.google.test/auth?state=${state}`,
      exchange: async () => {
        if (profile instanceof Error) throw profile;
        return profile;
      },
    };
  }
  let newComments = 0;
  const app = createApp({ config, sites, db, mailer, google, now, onNewComment: () => newComments++ });

  /** A signed-in reader on a site, created directly in the database. */
  const reader = (email: string, siteId = 'alt-web', name: string | null = email.split('@')[0]!) => {
    const user = findOrCreateUser(db, email, now());
    if (name) setDisplayName(db, user.id, name);
    return { user, token: createSession(db, user.id, siteId, now()) };
  };

  const api = (path: string, init: RequestInit & { token?: string; origin?: string | null; json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    const origin = init.origin === undefined ? ALT : init.origin;
    if (origin) headers.set('origin', origin);
    if (init.token) headers.set('authorization', `Bearer ${init.token}`);
    if (init.json !== undefined) headers.set('content-type', 'application/json');
    headers.set('x-forwarded-for', '203.0.113.7');
    return app.request(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  };

  const form = (path: string, data: Record<string, string>, extra: { origin?: string; cookie?: string } = {}) => {
    const headers: Record<string, string> = {
      'content-type': 'application/x-www-form-urlencoded',
      origin: extra.origin ?? BASE,
      'x-forwarded-for': '203.0.113.7',
    };
    if (extra.cookie) headers.cookie = extra.cookie;
    return app.request(path, { method: 'POST', headers, body: new URLSearchParams(data).toString() });
  };

  return { app, db, mailer, sites, config, now, advance, reader, api, form, newComments: () => newComments };
}

export type Setup = ReturnType<typeof setup>;

/** Posts a comment and returns its id. */
export async function post(s: Setup, token: string, body = 'A useful comment', path = '/tag/vrac/'): Promise<number> {
  const res = await s.api('/api/v1/sites/alt-web/comments', { method: 'POST', token, json: { path, body, lang: 'en' } });
  if (res.status !== 201) throw new Error(`post failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { comment: { id: number } }).comment.id;
}

export async function page(s: Setup, path = '/tag/vrac/', token?: string, after?: string) {
  const q = new URLSearchParams({ path, lang: 'en' });
  if (after) q.set('after', after);
  const res = await s.api(`/api/v1/sites/alt-web/page?${q}`, { token });
  return (await res.json()) as {
    comments: { id: number; author: string | null; body: string; status: string; mine: boolean; reply: { body: string } | null }[];
    reactions: { id: string; count: number; mine: boolean; label: string }[];
    me: { display_name: string | null } | null;
  };
}
