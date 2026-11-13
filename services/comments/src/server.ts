import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { googleProvider } from './google.ts';
import { createMailer } from './mailer.ts';
import { Notifier } from './notify.ts';
import { loadSites } from './sites.ts';
import {  MINUTE, systemClock } from './util.ts';

const config = loadConfig();
const sites = loadSites(config.sitesFile, { allowDevOrigins: config.allowDevOrigins });
const db = openDb(config.databasePath);
const mailer = createMailer(config.smtpUrl, config.mailFrom);
const google =
  config.googleClientId && config.googleClientSecret ? googleProvider(config.googleClientId, config.googleClientSecret) : undefined;

const notifier = new Notifier({ db, mailer, sites, adminEmail: config.adminEmail, baseUrl: config.baseUrl, now: systemClock });
const tick = () => notifier.tick().catch((err) => console.error('Notification failed:', err));
const timer = setInterval(tick, 15 * MINUTE);

const app = createApp({ config, sites, db, mailer, google, now: systemClock });

const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Comments service on http://localhost:${info.port} (${config.baseUrl})`);
  console.log(`Sites: ${[...sites.values()].map((s) => `${s.id} [${[...s.origins].join(', ')}]`).join('; ')}`);
  if (!google) console.log('Google sign-in is off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');
  if (!config.smtpUrl) console.log(config.emailSignIn ? 'SMTP_URL not set: mails are printed here.' : 'SMTP_URL not set: email sign-in is off; admin notifications are printed here.');
  if (config.devMode) console.log('DEV_MODE: the popup offers a sign-in without any check.');
});

function shutdown() {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
