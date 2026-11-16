import { type GoogleProvider, googleProvider } from '@babelcoach/google-auth';
import sitesYaml from '../../sites.yaml?raw';
import { CommentsApi } from './comments-api.ts';
import { type ConsoleConfig, loadConfig } from './config.ts';
import { SearchService } from './search.ts';
import { SearchConsoleClient } from './search-console.ts';
import { type Sites, parseSites } from './sites.ts';
import { UmamiClient } from './umami.ts';
import { VisitsService } from './visits.ts';

export interface ConsoleContext {
  config: ConsoleConfig;
  sites: Sites;
  comments: CommentsApi;
  visits: VisitsService;
  search: SearchService;
  google: GoogleProvider | undefined;
  now: () => number;
}

export function createContext(config: ConsoleConfig, sites: Sites, now: () => number = Date.now): ConsoleContext {
  const umami = config.umami ? new UmamiClient(config.umami) : undefined;
  return {
    config,
    sites,
    comments: new CommentsApi({ baseUrl: config.commentsApiUrl, token: config.consoleToken }),
    visits: new VisitsService({ umami, sites, now }),
    search: new SearchService({
      client: config.searchConsole
        ? new SearchConsoleClient({ ...config.searchConsole, apiUrl: config.searchConsoleApiUrl, tokenUrl: config.googleTokenUrl, now })
        : undefined,
      sites,
      now,
    }),
    google: config.google ? googleProvider(config.google.clientId, config.google.clientSecret) : undefined,
    now,
  };
}

let current: ConsoleContext | undefined;

/** The console's configuration and clients, built once from the environment. */
export function getContext(): ConsoleContext {
  if (!current) {
    current = createContext(loadConfig(process.env), parseSites(sitesYaml));
    const c = current.config;
    console.log(`Console at ${c.consoleUrl}; comments service ${c.commentsApiUrl}${c.consoleToken ? '' : ' (CONSOLE_TOKEN not set: Comments unavailable)'}`);
    console.log(c.umami ? `Visits from Umami at ${c.umami.url}` : 'Visits are off (UMAMI_URL / UMAMI_USERNAME / UMAMI_PASSWORD not set).');
    console.log(c.searchConsole ? `Search from Search Console as ${c.searchConsole.clientEmail}` : 'Search is off (GOOGLE_SERVICE_ACCOUNT_JSON not set).');
    if (!c.google) console.log('Google sign-in is off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');
    if (c.devMode) console.log('DEV_MODE: the sign-in page offers a sign-in without Google.');
  }
  return current;
}
