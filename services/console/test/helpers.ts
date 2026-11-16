import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConsoleConfig } from '../src/lib/config.ts';
import { parseSites } from '../src/lib/sites.ts';

export const sites = parseSites(readFileSync(resolve(import.meta.dirname, '../sites.yaml'), 'utf8'));

export function config(over: Partial<ConsoleConfig> = {}): ConsoleConfig {
  return {
    consoleUrl: 'https://console.test',
    commentsApiUrl: 'https://comments.test',
    consoleToken: 't'.repeat(40),
    adminEmails: ['admin@example.org', 'second@example.org'],
    sessionSecret: 's'.repeat(40),
    devMode: false,
    production: false,
    searchConsoleApiUrl: 'https://searchconsole.test',
    googleTokenUrl: 'https://oauth2.test/token',
    ...over,
  };
}

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** A fetch that routes to `handler` and records the calls. */
export function fakeFetch(handler: Handler) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
