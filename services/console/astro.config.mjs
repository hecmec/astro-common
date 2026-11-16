// @ts-check
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// The BabelCoach admin console: server-rendered on every request (no static pages).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4340 },
  // The console checks the Origin of state-changing requests against CONSOLE_URL itself
  // (src/middleware.ts): behind Coolify's proxy the request URL Astro sees is not the public one.
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
});
