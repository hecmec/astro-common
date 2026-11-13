# @babelcoach/astro-comments

The "Your reactions, your comments" section under a page of a BabelCoach site. At build time it writes into the HTML the comments the service has exported (published more than `bake_after_days` ago, so crawlers see them); in the browser the widget adds newer comments, live reactions and the comment form.

## Install in a site

1. Dependency, pinned to a tag of the public astro-common repo:

   ```json
   "@babelcoach/astro-comments": "github:hecmec/astro-common#comments-v1.0.0&path:packages/astro-comments"
   ```

2. Build variable with the service URL (in `.env` for development, as a Coolify build variable for staging and production):

   ```
   PUBLIC_COMMENTS_URL=https://comments.babelcoach.com
   ```

3. The site's domains must be listed under its id in the service's `sites.yaml`.

4. In the page layout, under the content:

   ```astro
   ---
   import Comments from '@babelcoach/astro-comments/Comments.astro';
   ---
   <Comments site="alt-web" />
   ```

   Props: `site` (required, id in `sites.yaml`), `api` (default `PUBLIC_COMMENTS_URL`), `path` (default the current page), `lang` (default `Astro.currentLocale`, then `en`).

5. If the site sends a Content-Security-Policy, allow the service in `script-src` and `connect-src`.

6. Schedule a nightly redeploy of production (Coolify scheduled task or cron on the deploy webhook), so comments reaching the delay, and removed ones, follow within a day.

7. Mention the comments in the privacy page: email address, display name and comments are stored by the comments service (BabelCoach); readers can delete their account from the widget.

The build never fails because of the service: if the export cannot be fetched within 5 seconds, a warning is logged and the section is rendered without baked comments; the widget then loads them all.

## Styling

Baked comments use the classes `.bc-comments`, `.bc-comment`, `.bc-reply`, `.bc-static-reactions`. The widget renders in a shadow root and inherits the page's font and text colour. Both read these custom properties:

`--bc-accent`, `--bc-accent-text`, `--bc-muted`, `--bc-border`, `--bc-surface`, `--bc-radius`, `--bc-danger`.

## Without Astro

```html
<div data-bc-comments data-site="alt-web"></div>
<script src="https://comments.babelcoach.com/widget.js" defer></script>
```
