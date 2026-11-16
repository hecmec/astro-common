import { defineConfig } from '@playwright/test';

// Three builds of the same console against the fake upstreams (e2e/fakes.ts):
//   A :4386  everything works
//   B :4387  comments service down, Umami fails for bon-et-gratuit
//   C :4388  Umami down
// `pnpm test:e2e` builds the console first.
const FAKES = 'http://localhost:4389';
const env = (port: number, comments: string, umami: string) => ({
  PORT: String(port),
  HOST: 'localhost',
  CONSOLE_URL: `http://localhost:${port}`,
  COMMENTS_API_URL: comments,
  CONSOLE_TOKEN: 'e2e-console-token-0123456789abcdefghij',
  UMAMI_URL: umami,
  UMAMI_USERNAME: 'console',
  UMAMI_PASSWORD: 'e2e-umami-pw',
  ADMIN_EMAILS: 'admin@example.org',
  SESSION_SECRET: 'e2e-session-secret-0123456789abcdefghij',
  DEV_MODE: 'true',
});
const consoleServer = (port: number, comments: string, umami: string) => ({
  command: 'node dist/server/entry.mjs',
  url: `http://localhost:${port}/healthz`,
  env: env(port, comments, umami),
  reuseExistingServer: false,
  stdout: 'pipe' as const,
});

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:4386', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/fakes.ts', url: `${FAKES}/__stats`, reuseExistingServer: false, stdout: 'pipe' },
    consoleServer(4386, FAKES, FAKES),
    consoleServer(4387, `${FAKES}/down`, `${FAKES}/fail-bg`),
    consoleServer(4388, FAKES, `${FAKES}/down`),
  ],
});
