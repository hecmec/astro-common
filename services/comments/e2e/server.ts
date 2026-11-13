// Test servers for the browser tests:
//   :4398  the comments service (dev mode, in-memory database, mails kept in memory)
//   :4397  a fixture "site" whose pages embed the widget (allowed dev origin)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { clearExportCache, fetchExport, renderSection } from '../../../packages/astro-comments/index.js';
import { createApp } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { openDb } from '../src/db.ts';
import { MemoryMailer } from '../src/mailer.ts';
import { parseSites } from '../src/sites.ts';
import { DAY } from '../src/util.ts';

const SERVICE = 'http://localhost:4398';
const SITE = 'http://localhost:4397';

let offset = 0;
const now = () => Date.now() + offset;

const config: Config = {
  baseUrl: SERVICE,
  adminEmail: 'admin@example.org',
  mailFrom: 'test@localhost',
  databasePath: ':memory:',
  sitesFile: '',
  allowDevOrigins: true,
  devMode: true,
  trustProxy: false,
  port: 4398,
  production: false,
};
const sites = parseSites(
  `sites:
  alt-web:
    name: Alt Web
    domains: [www.alt-web.org]
    dev_origins: [${SITE}]
    bake_after_days: 7
    reactions:
      - { id: useful, icon: "👍", label: { en: Useful, fr: Utile, de: Hilfreich } }
      - { id: tried, icon: "✅", label: { en: I use it, fr: Je l’utilise, de: Nutze ich } }
`,
  { allowDevOrigins: true },
);
const db = openDb(':memory:');
const mailer = new MemoryMailer();
const app = createApp({ config, sites, db, mailer, now });
serve({ fetch: app.fetch, port: 4398 });

const widget = () => readFileSync(resolve(import.meta.dirname, '../public/widget.js'));

const shell = (lang: string, body: string) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>Fixture</title>
<style>body { font-family: sans-serif; max-width: 40rem; margin: 2rem auto; --bc-accent: #7a3e9d; }</style></head>
<body><h1>Fixture page</h1>${body}</body></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', SITE);
  const send = (status: number, type: string, body: string | Buffer) => {
    res.writeHead(status, { 'content-type': type });
    res.end(body);
  };
  if (url.pathname === '/widget.js') return send(200, 'text/javascript', widget());
  if (url.pathname === '/__test/mails') return send(200, 'application/json', JSON.stringify(mailer.sent));
  if (url.pathname === '/__test/advance') {
    offset += Number(url.searchParams.get('days') ?? 0) * DAY;
    return send(200, 'text/plain', 'ok');
  }
  if (url.pathname.startsWith('/baked/')) {
    clearExportCache();
    const data = await fetchExport(SERVICE, 'alt-web');
    return send(200, 'text/html', shell('en', renderSection({ site: 'alt-web', api: SERVICE, path: url.pathname, lang: 'en', data })));
  }
  if (url.pathname.startsWith('/down/')) {
    return send(200, 'text/html', shell('en', `<div data-bc-comments data-site="alt-web" data-api="http://localhost:4396"></div><script src="/widget.js" defer></script>`));
  }
  const lang = url.searchParams.get('lang') ?? 'fr';
  return send(200, 'text/html', shell(lang, `<div data-bc-comments data-site="alt-web" data-api="${SERVICE}"></div><script src="/widget.js" defer></script>`));
}).listen(4397, () => console.log('e2e servers ready'));
