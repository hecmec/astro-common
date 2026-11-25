// @ts-check
/**
 * Last-modified dates for the sitemap of a BabelCoach site (@astrojs/sitemap in astro.config.mjs).
 * Read from the Markdown files at config time, since the content layer is not available there.
 * Plain JavaScript (checked with JSDoc) because Node does not strip types inside node_modules.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** @typedef {import('./index.d.ts').PageUpdateDatesOptions} PageUpdateDatesOptions */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Top-level `key: YYYY-MM-DD` in a frontmatter block, quoted or not, with or without a time.
 *
 * @param {string} frontmatter
 * @param {string} key
 * @returns {string | undefined}
 */
function day(frontmatter, key) {
  return new RegExp(`^${key}:[ \\t]*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm').exec(frontmatter)?.[1];
}

/**
 * Page path -> "YYYY-MM-DD": each page of `pages` gets the `update_date` of its frontmatter, else its
 * `creation_date`. A translation (`<folder>/<locale>/<id>.md`, which has no dates of its own) gets the
 * date of its main page, under `/<locale>` + the page path.
 *
 * @param {PageUpdateDatesOptions} options
 * @returns {Map<string, string>}
 */
export function pageUpdateDates({ pages, locales = [], contentDir = 'src/content' }) {
  /** @type {Map<string, string>} */
  const dates = new Map();
  for (const [folder, pattern] of Object.entries(pages)) {
    const dir = `${contentDir}/${folder}`;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
      const frontmatter = FRONTMATTER.exec(readFileSync(`${dir}/${file}`, 'utf8'))?.[1] ?? '';
      const date = day(frontmatter, 'update_date') ?? day(frontmatter, 'creation_date');
      if (!date) continue;
      const path = pattern.replace('__id__', file.replace(/\.md$/, ''));
      dates.set(path, date);
      for (const locale of locales) {
        if (existsSync(`${dir}/${locale}/${file}`)) dates.set(`/${locale}${path}`, date);
      }
    }
  }
  return dates;
}

/**
 * `serialize` option of @astrojs/sitemap: adds `lastmod` to the entries whose path has a date.
 *
 * @template {{ url: string }} T
 * @param {Map<string, string>} dates from pageUpdateDates
 * @returns {(item: T) => T}
 */
export function serializeLastmod(dates) {
  return (item) => {
    const lastmod = dates.get(new URL(item.url).pathname);
    return lastmod ? { ...item, lastmod } : item;
  };
}
