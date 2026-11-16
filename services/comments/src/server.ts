import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { googleProvider } from '@babelcoach/google-auth';
import { createMailer } from './mailer.ts';
import { Notifier } from './notify.ts';
import { Rebuilder, coolifyDeployer } from './rebuild.ts';
import { loadSites } from './sites.ts';
import { MINUTE, systemClock } from './util.ts';

const config = loadConfig();
const sites = loadSites(config.sitesFile, { allowDevOrigins: config.allowDevOrigins });
const db = openDb(config.databasePath);
const mailer = createMailer(config.smtpUrl, config.mailFrom);
const google =
  config.googleClientId && config.googleClientSecret ? googleProvider(config.googleClientId, config.googleClientSecret) : undefined;

const notifier = new Notifier({ db, mailer, sites, adminEmail: config.adminEmail, baseUrl: config.baseUrl, consoleUrl: config.consoleUrl, now: systemClock });
const tick = () => notifier.tick().catch((err) => console.error('Notification failed:', err));
const timer = setInterval(tick, 15 * MINUTE);

// Nightly rebuild of the sites whose baked comments changed (Coolify deploy API).
const rebuilder =
  config.coolifyApiUrl && config.coolifyDeployToken
    ? new Rebuilder({ db, sites, deploy: coolifyDeployer(config.coolifyApiUrl, config.coolifyDeployToken), now: systemClock, at: config.rebuildAt })
    : undefined;
const rebuildTimer = rebuilder ? setInterval(() => rebuilder.tick().catch((err) => console.error('Rebuild check failed:', err)), 10 * MINUTE) : undefined;

const app = createApp({ config, sites, db, mailer, google, now: systemClock, rebuilder });

// '::' listens on IPv6 and IPv4. In the Alpine image "localhost" is ::1, and Coolify's
// health check calls http://localhost:<port>/healthz.
const server = serve({ fetch: app.fetch, port: config.port, hostname: '::' }, (info) => {
  console.log(`Comments service on http://localhost:${info.port} (${config.baseUrl})`);
  console.log(`Sites: ${[...sites.values()].map((s) => `${s.id} [${[...s.origins].join(', ')}]`).join('; ')}`);
  if (!google) console.log('Google sign-in is off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');
  if (!config.smtpUrl) console.log(config.emailSignIn ? 'SMTP_URL not set: mails are printed here.' : 'SMTP_URL not set: email sign-in is off; admin notifications are printed here.');
  console.log(
    rebuilder
      ? `Nightly rebuild at ${config.rebuildAt} Europe/Paris for: ${rebuilder.configuredSites().map((s) => s.id).join(', ') || 'no site (none has rebuild.coolify_app)'}`
      : 'Nightly rebuild is off (COOLIFY_API_URL / COOLIFY_DEPLOY_TOKEN not set).',
  );
  console.log(config.consoleToken ? 'Admin API for the console is on.' : 'Admin API is off (CONSOLE_TOKEN not set).');
  if (config.devMode) console.log('DEV_MODE: the popup offers a sign-in without any check.');
});

function shutdown() {
  clearInterval(timer);
  if (rebuildTimer) clearInterval(rebuildTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
