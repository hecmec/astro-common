# @babelcoach/sitemap-dates

`lastmod` dates for the sitemap of a BabelCoach site. Each page of a collection gets the `update_date` of its frontmatter, else its `creation_date`, so search engines learn when a rewrite changed it. A translation (`<folder>/<locale>/<id>.md`, with no dates of its own) gets the date of its main page: the rewrite skills update the translations together with the main page.

The files are read at config time, since the content layer is not available in `astro.config.mjs`. No dependencies.

## Install in a site

1. Dependency, pinned to a tag of the public astro-common repo:

   ```json
   "@babelcoach/sitemap-dates": "github:hecmec/astro-common#sitemap-dates-v1.0.0&path:packages/sitemap-dates"
   ```

2. In `astro.config.mjs`:

   ```js
   import sitemap from '@astrojs/sitemap';
   import { pageUpdateDates, serializeLastmod } from '@babelcoach/sitemap-dates';

   const updateDates = pageUpdateDates({
     pages: { items: '/recipes/__id__/', infos: '/infos/__id__/' },
     // Prefixed locales whose translations are in items/<locale>/ and infos/<locale>/; omit for a one-language site.
     locales: ['fr', 'de'],
   });

   // in integrations:
   sitemap({ serialize: serializeLastmod(updateDates) });
   ```

`pageUpdateDates` returns a `Map` from page path (`/recipes/hummus/`, `/fr/recipes/hummus/`) to `YYYY-MM-DD`. Pages without a date, and every other page of the site, get no `lastmod`.
