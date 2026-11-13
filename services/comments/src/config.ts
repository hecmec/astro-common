import { resolve } from 'node:path';

export interface Config {
  /** Public URL of the service, without trailing slash. */
  baseUrl: string;
  adminEmail: string;
  googleClientId?: string;
  googleClientSecret?: string;
  /** nodemailer connection URL; without it, mails are printed to the log. */
  smtpUrl?: string;
  /** Email-link sign-in is offered: with SMTP, or in development (links printed to the log). */
  emailSignIn: boolean;
  mailFrom: string;
  databasePath: string;
  sitesFile: string;
  /** Accept the dev_origins of sites.yaml (localhost). Never in production. */
  allowDevOrigins: boolean;
  /** Offer a password-less "dev sign-in" in the popup. Never in production. */
  devMode: boolean;
  /** Read the client IP from X-Forwarded-For (behind Coolify's proxy). */
  trustProxy: boolean;
  port: number;
  production: boolean;
}

const bool = (v: string | undefined) => v === 'true' || v === '1';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 4330);
  const config: Config = {
    baseUrl: (env.BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
    adminEmail: (env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
    googleClientId: env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || undefined,
    smtpUrl: env.SMTP_URL || undefined,
    emailSignIn: !!env.SMTP_URL || !production,
    mailFrom: env.MAIL_FROM ?? 'Comments <comments@localhost>',
    databasePath: env.DATABASE_PATH ?? resolve('data/comments.db'),
    sitesFile: env.SITES_FILE ?? resolve(import.meta.dirname, '../sites.yaml'),
    allowDevOrigins: bool(env.ALLOW_DEV_ORIGINS),
    devMode: bool(env.DEV_MODE),
    trustProxy: bool(env.TRUST_PROXY),
    port,
    production,
  };
  if (production) {
    const problems: string[] = [];
    if (!config.baseUrl.startsWith('https://')) problems.push('BASE_URL must be an https URL');
    if (!config.adminEmail) problems.push('ADMIN_EMAIL is required');
    if (config.allowDevOrigins) problems.push('ALLOW_DEV_ORIGINS is not allowed in production');
    if (config.devMode) problems.push('DEV_MODE is not allowed in production');
    if (problems.length) throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  }
  return config;
}
