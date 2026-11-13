## Why

The four BabelCoach sites (alternative-web, simplygoodfood, anglais-gratuit, bonetgratuit) are static Astro builds with no way for readers to react or correct a page. A shared, moderated comments service gives them readers' feedback and some fresh, user-written content under each page, without turning any site into a dynamic application. astro-common is where code shared by the four sites will live, and this is its first piece.

## What Changes

- New standalone **comments service** in astro-common, deployed on its own domain on the existing Coolify server, independent of the four sites' builds and hosting, on Node 26 LTS with a small, guarded dependency tree (7-day release delay, no install scripts) after the 2025–2026 npm supply-chain attacks.
- An explicit **list of allowed domains**: only pages on those domains can embed the service; each domain belongs to one site.
- **Sign-in** with Google or with a passwordless email link. FranceConnect (and through it L'Identité Numérique La Poste) is left out of v1: it is reserved for public services and approved partners, and an association collecting comments is unlikely to qualify.
- Signed-in readers can **post a text comment on a page** (identified by site and URL path) and add **quick reactions** (a fixed set of one-click reactions with counts).
- Every comment (at most 500 characters) waits for **moderation by a single admin**, who publishes or refuses it from an admin page, can add a **public admin reply** under a published comment, and can mark a comment **sticky**.
- A page shows at most its **300 most recent comments**, plus the sticky ones, which keep their place.
- An **embeddable widget** (one script include, no iframe) shows a "Your reactions, your comments" section under a page, in the page's language (en, fr, de).
- **Static export**: published comments older than N days (a per-site setting) are fetched by each site's build and written into the HTML, so crawlers see them. A scheduled nightly redeploy of each site picks up newly eligible comments. The widget then only loads the newer ones.
- An **Astro component** in astro-common that the four sites add to their page layout to render the baked comments and load the widget.

## Capabilities

### New Capabilities

- `comment-auth`: reader sign-in (Google, email link), sessions usable from the four sites' origins, admin identification, sign-out and account deletion.
- `page-comments`: posting, listing and deleting text comments on a page, the widget that shows them, the allowed domains and page identity.
- `comment-moderation`: the pending/published/refused workflow, the admin page, admin replies and notification of new comments.
- `page-reactions`: one-click reactions on a page with public counts.
- `comment-static-export`: the export of published comments older than N days for site builds, the Astro component that renders them, and how the widget avoids showing them twice.

### Modified Capabilities

(none: astro-common has no specs yet)

## Impact

- **New code** in astro-common: the service (API, admin page, database), the browser widget, the Astro component.
- **New infrastructure**: a Coolify application with a persistent volume for the database, a domain (e.g. `comments.babelcoach.com`), a Google OAuth client, an SMTP account for sign-in links and admin notifications.
- **The four sites** (separate changes in each repo): add the Astro component to the page layout, add the service's base URL as a build variable, allow the service in their Content-Security-Policy if they have one, schedule a nightly redeploy, and mention the comments in their privacy page (personal data: email, display name, comments).
- **GDPR**: the association becomes controller of readers' email addresses and comments; readers must be able to delete their comments and account.
