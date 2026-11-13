import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:4397', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @babelcoach/comments-widget run build && node e2e/server.ts',
    url: 'http://localhost:4397/widget.js',
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
