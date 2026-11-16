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
const url = (v: string | undefined) => (v?.trim() ? v.trim().replace(/\/+$/, '') : undefined);

export function loadConfig(env: Env): ConsoleConfig {
  const production = env.NODE_ENV === 'production';
  const problems: string[] = [];
  const umamiUrl = url(env.UMAMI_URL);
  const config: ConsoleConfig = {
    consoleUrl: url(env.CONSOLE_URL) ?? `http://localhost:${env.PORT ?? 4340}`,
    commentsApiUrl: url(env.COMMENTS_API_URL) ?? 'http://localhost:4330',
    consoleToken: env.CONSOLE_TOKEN?.trim() ?? '',
    umami: umamiUrl && env.UMAMI_USERNAME && env.UMAMI_PASSWORD ? { url: umamiUrl, username: env.UMAMI_USERNAME, password: env.UMAMI_PASSWORD } : undefined,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : undefined,
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    // Development without a secret: a random one, so a restart signs everyone out.
    sessionSecret: env.SESSION_SECRET?.trim() || (production ? '' : randomBytes(32).toString('base64url')),
    devMode: bool(env.DEV_MODE),
    production,
  };

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
  }
  if (problems.length) throw new Error(`Invalid console configuration:\n- ${problems.join('\n- ')}`);
  return config;
}
