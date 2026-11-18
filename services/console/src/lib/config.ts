import { randomBytes } from 'node:crypto';

export interface ConsoleConfig {
  /** Public URL of the console, without trailing slash (Origin checks, Google redirect URI). */
  consoleUrl: string;
  /** Comments service base URL, without trailing slash. */
  commentsApiUrl: string;
  /** Shared secret for the comments service's admin API; empty: the Comments page says it is unavailable. */
  consoleToken: string;
  /** Umami v3 server and a view-only account; absent: the Visits page says it is unavailable. */
  umami?: { url: string; username: string; password: string };
  google?: { clientId: string; clientSecret: string };
  /** Google service account with read-only access to the Search Console properties; absent: Search unavailable. */
  searchConsole?: { clientEmail: string; privateKey: string };
  /** Search Console API and Google token endpoint (overridable for the browser tests, never in production). */
  searchConsoleApiUrl: string;
  googleTokenUrl: string;
  /** Verified Google emails allowed in, lowercased. */
  adminEmails: string[];
  /** HMAC key of the session cookie. */
  sessionSecret: string;
  /** Offer a sign-in without Google (development only). */
  devMode: boolean;
  production: boolean;
}

type Env = Record<string, string | undefined>;

const bool = (v: string | undefined) => v === 'true' || v === '1';

export const SEARCH_CONSOLE_API_URL = 'https://searchconsole.googleapis.com';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** The downloaded JSON key of a service account, raw or base64; undefined when unset. */
export function parseServiceAccount(value: string | undefined): { clientEmail: string; privateKey: string } | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not a JSON key (raw or base64)');
  }
  const k = json as { client_email?: unknown; private_key?: unknown };
  if (typeof k.client_email !== 'string' || typeof k.private_key !== 'string' || !k.private_key.includes('PRIVATE KEY')) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON needs client_email and private_key');
  }
  return { clientEmail: k.client_email, privateKey: k.private_key };
}

const url = (v: string | undefined) => (v?.trim() ? v.trim().replace(/\/+$/, '') : undefined);

export function loadConfig(env: Env): ConsoleConfig {
  const production = env.NODE_ENV === 'production';
  const problems: string[] = [];
  const umamiUrl = url(env.UMAMI_URL);
  const config: ConsoleConfig = {
    consoleUrl: url(env.CONSOLE_URL) ?? `http://localhost:${env.PORT ?? 4331}`,
    commentsApiUrl: url(env.COMMENTS_API_URL) ?? 'http://localhost:4330',
    consoleToken: env.CONSOLE_TOKEN?.trim() ?? '',
    umami: umamiUrl && env.UMAMI_USERNAME && env.UMAMI_PASSWORD ? { url: umamiUrl, username: env.UMAMI_USERNAME, password: env.UMAMI_PASSWORD } : undefined,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : undefined,
    searchConsole: undefined,
    searchConsoleApiUrl: url(env.SEARCH_CONSOLE_API_URL) ?? SEARCH_CONSOLE_API_URL,
    googleTokenUrl: url(env.GOOGLE_TOKEN_URL) ?? GOOGLE_TOKEN_URL,
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    // Development without a secret: a random one, so a restart signs everyone out.
    sessionSecret: env.SESSION_SECRET?.trim() || (production ? '' : randomBytes(32).toString('base64url')),
    devMode: bool(env.DEV_MODE),
    production,
  };

  try {
    config.searchConsole = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (err) {
    problems.push((err as Error).message);
  }
  for (const e of config.adminEmails) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) problems.push(`ADMIN_EMAILS: "${e}" is not an email address`);
  if (umamiUrl && !config.umami) problems.push('UMAMI_URL needs UMAMI_USERNAME and UMAMI_PASSWORD');
  if (production) {
    if (!config.consoleUrl.startsWith('https://')) problems.push('CONSOLE_URL must be an https URL');
    if (!config.commentsApiUrl.startsWith('https://')) problems.push('COMMENTS_API_URL must be an https URL');
    if (config.consoleToken.length < 32) problems.push('CONSOLE_TOKEN is required (at least 32 characters, same as the comments service)');
    if (config.sessionSecret.length < 32) problems.push('SESSION_SECRET is required (at least 32 characters)');
    if (!config.google) problems.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
    if (!config.adminEmails.length) problems.push('ADMIN_EMAILS is required');
    if (config.devMode) problems.push('DEV_MODE is not allowed in production');
    if (env.SEARCH_CONSOLE_API_URL || env.GOOGLE_TOKEN_URL) problems.push('SEARCH_CONSOLE_API_URL and GOOGLE_TOKEN_URL are for tests only, not allowed in production');
  }
  if (problems.length) throw new Error(`Invalid console configuration:\n- ${problems.join('\n- ')}`);
  return config;
}
