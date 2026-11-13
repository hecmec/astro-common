## Purpose

Puts published comments that have been online for some days into the static HTML of the sites, so search engines and readers without JavaScript see them, without making the sites depend on the service at runtime.

## ADDED Requirements

### Requirement: Export of comments ready to bake
The service SHALL provide, for each site, a public export of every published, non-deleted comment whose publication is older than the site's configured number of days (default 7) and that its page keeps under the per-page limit (300 most recent plus sticky ones), with its admin reply, grouped by page path, together with the reaction counts per page and the cutoff date used.

#### Scenario: Comment younger than the delay
- **WHEN** a comment was published 3 days ago on a site configured with 7 days
- **THEN** it is not in the export

#### Scenario: Comment older than the delay
- **WHEN** a comment was published 8 days ago and is still published
- **THEN** it is in the export under its page path

#### Scenario: Comment cut by the page limit
- **WHEN** a page has 305 published comments older than the delay and none is sticky
- **THEN** the export holds the 300 most recent of them

#### Scenario: Deleted or unpublished comment
- **WHEN** a comment older than the delay has since been deleted or refused
- **THEN** it is not in the export

### Requirement: Baked comments in the HTML
A site that includes the shared Astro component SHALL render, at build time, the exported comments and reaction counts of each page in the page's HTML, inside the "Your reactions, your comments" section, readable without JavaScript.

#### Scenario: Crawler reads a page
- **WHEN** a page with exported comments is fetched without running JavaScript
- **THEN** the HTML contains those comments' text, author display names and dates

### Requirement: No duplicates between baked and live comments
The widget SHALL show baked comments once: it SHALL load from the service only the comments published after the cutoff date of the build, and SHALL fall back to loading all comments when the page has no cutoff.

#### Scenario: Page built with a cutoff
- **WHEN** the widget loads on a page built with a cutoff date
- **THEN** it adds only comments published after that date below the baked ones

#### Scenario: Export failed at build
- **WHEN** a page was built without exported comments because the export failed
- **THEN** the widget loads and shows all published comments of the page

### Requirement: Builds never fail because of comments
A site build SHALL succeed when the export cannot be fetched (service down, timeout after 5 seconds, invalid response), rendering the section without baked comments and logging a warning.

#### Scenario: Service down during a build
- **WHEN** a site is built while the service is unreachable
- **THEN** the build completes, a warning is logged, and pages render without baked comments

### Requirement: Regular refresh
Each site's production deployment SHALL be rebuilt at least once a day, so that comments reaching the delay, and comments deleted or unpublished, are reflected in the baked HTML within a day.

#### Scenario: Comment reaches the delay
- **WHEN** a published comment passes the 7-day delay
- **THEN** it is in the site's HTML after the next nightly build
