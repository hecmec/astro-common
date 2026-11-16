import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { type Deps, createLimits } from './context.ts';
import { adminApiRoutes } from './routes/admin-api.ts';
import { adminRoutes } from './routes/admin.ts';
import { apiRoutes } from './routes/api.ts';
import { authRoutes } from './routes/auth.ts';

const PUBLIC_DIR = resolve(import.meta.dirname, '../public');

const PAGE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

function staticFile(name: string, type: string, cache: string) {
  let cached: Buffer | undefined;
  return () => {
    try {
      cached ??= readFileSync(resolve(PUBLIC_DIR, name));
    } catch {
      return new Response('Not found', { status: 404 });
    }
    return new Response(new Uint8Array(cached), {
      headers: { 'content-type': type, 'cache-control': cache, 'access-control-allow-origin': '*' },
    });
  };
}

export function createApp(deps: Deps): Hono {
  const app = new Hono();
  const limits = createLimits(deps.now);

  app.use('*', async (c, next) => {
    await next();
    c.header('x-content-type-options', 'nosniff');
    // same-origin, not no-referrer: with no-referrer browsers send "Origin: null" on
    // form posts, which the same-origin checks would refuse.
    c.header('referrer-policy', 'same-origin');
    if (c.res.headers.get('content-type')?.startsWith('text/html')) {
      c.header('content-security-policy', PAGE_CSP);
      c.header('x-frame-options', 'DENY');
    }
  });

  app.get('/healthz', (c) => c.json({ ok: true }));
  app.get('/', (c) => c.text('BabelCoach comments service'));
  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

  const widget = staticFile('widget.js', 'text/javascript; charset=utf-8', 'public, max-age=3600');
  const popup = staticFile('popup.js', 'text/javascript; charset=utf-8', 'public, max-age=3600');
  app.get('/widget.js', () => widget());
  app.get('/popup.js', () => popup());

  app.route('/auth', authRoutes(deps, limits));
  app.route('/api/v1', apiRoutes(deps));
  app.route('/api/admin/v1', adminApiRoutes(deps));
  app.route('/admin', adminRoutes(deps));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
