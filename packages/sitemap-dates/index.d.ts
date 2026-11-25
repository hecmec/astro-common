export interface PageUpdateDatesOptions {
  /** Collection folder under `contentDir` -> page path with `__id__`, e.g. `{ items: '/recipes/__id__/' }`. */
  pages: Record<string, string>;
  /** Locales with a URL prefix whose translations live in `<folder>/<locale>/<id>.md`, e.g. `['fr', 'de']`. */
  locales?: readonly string[];
  /** Default `src/content`, relative to the working directory. */
  contentDir?: string;
}

/** Page path ("/recipes/hummus/", "/fr/recipes/hummus/") -> "YYYY-MM-DD". */
export function pageUpdateDates(options: PageUpdateDatesOptions): Map<string, string>;

/** `serialize` option of @astrojs/sitemap: adds `lastmod` to the entries whose path has a date. */
export function serializeLastmod<T extends { url: string }>(dates: Map<string, string>): (item: T) => T;
