// @ts-check
/**
 * Build-time access to the comments service export.
 * Plain JavaScript (checked with JSDoc) because Node does not strip types inside node_modules.
 */
export { renderSection, normalizePath, labels } from './render.js';

/** @typedef {import('./index.d.ts').ExportData} ExportData */

/** @type {Map<string, Promise<ExportData | null>>} */
const cache = new Map();

/**
 * Fetches the export of a site once per build. Never throws: on failure it logs a warning
 * and resolves to null, and pages are rendered without baked comments.
 *
 * @param {string} api  Service URL, e.g. https://comments.babelcoach.com
 * @param {string} site Site id from the service's sites.yaml
 * @param {{ timeout?: number, fetch?: typeof fetch, logger?: Pick<Console, 'warn'> }} [opts]
 * @returns {Promise<ExportData | null>}
 */
export function fetchExport(api, site, opts = {}) {
  const key = `${api}|${site}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = load(api, site, opts);
    cache.set(key, pending);
  }
  return pending;
}

/** Forgets cached exports (tests, long-running dev servers). */
export function clearExportCache() {
  cache.clear();
}

/**
 * @param {string} api
 * @param {string} site
 * @param {{ timeout?: number, fetch?: typeof fetch, logger?: Pick<Console, 'warn'> }} opts
 * @returns {Promise<ExportData | null>}
 */
async function load(api, site, opts) {
  const doFetch = opts.fetch ?? fetch;
  const logger = opts.logger ?? console;
  const url = `${api.replace(/\/+$/, '')}/api/v1/sites/${encodeURIComponent(site)}/export`;
  try {
    const res = await doFetch(url, { signal: AbortSignal.timeout(opts.timeout ?? 5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== 'object' || typeof data.cutoff !== 'string' || typeof data.pages !== 'object' || data.pages === null) {
      throw new Error('unexpected response');
    }
    return /** @type {ExportData} */ (data);
  } catch (err) {
    logger.warn(`[astro-comments] Could not fetch comments from ${url} (${err instanceof Error ? err.message : err}); pages are built without baked comments.`);
    return null;
  }
}
