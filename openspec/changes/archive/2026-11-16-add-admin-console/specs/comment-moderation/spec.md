## MODIFIED Requirements

### Requirement: Moderation queue
The console's Comments page SHALL list pending comments of all sites, oldest first, each with its site (badge in the site's colour), page link, language, author display name and email, date and text. The page SHALL offer a filter by site, which the four sites' admin areas can link to directly.

#### Scenario: Open the queue
- **WHEN** the admin opens the console's Comments page
- **THEN** all pending comments are listed with a filter by site

#### Scenario: Link from a site's admin
- **WHEN** the admin follows the comments link of alt-web's admin area
- **THEN** the Comments page opens filtered on alt-web

### Requirement: History and search
The console's Comments page SHALL also list published and refused comments, with status tabs showing each status's count, filterable by site and page. Changing tab SHALL keep the site and page filters, and an action on a comment SHALL bring the admin back to the same tab and filters.

#### Scenario: Find comments on a page
- **WHEN** the admin filters by a page path
- **THEN** every comment on that page is listed with its status

#### Scenario: Back to the same list
- **WHEN** the admin publishes a comment while the list is filtered on simplygoodfood
- **THEN** the page shows the pending list of simplygoodfood again, without the published comment

### Requirement: New-comment notification
The service SHALL email the admin about new comments, at most one email per 6 hours summarising the comments posted since the previous one, with a link to the console's Comments page (to the comments service's admin page when no console address is configured).

#### Scenario: Several comments in a few hours
- **WHEN** three comments are posted within five hours
- **THEN** the admin receives one email listing all three, with a link to the console's Comments page

### Requirement: Sticky comments
The admin SHALL be able to mark a published comment sticky and remove the mark. A sticky comment SHALL keep its place by publication date and SHALL never be cut when its page has more comments than the page limit.

#### Scenario: Make a comment sticky
- **WHEN** the admin marks a published comment sticky
- **THEN** the Comments page shows it as sticky, and it stays on its page however many newer comments follow

#### Scenario: Remove the mark
- **WHEN** the admin removes the sticky mark from a comment older than the page's 300 most recent
- **THEN** it is no longer shown on the page

## ADDED Requirements

### Requirement: Moderation without client scripts
Every moderation action on the console's Comments page (publish, refuse, unpublish, sticky, reply, block, unblock) SHALL work with JavaScript turned off.

#### Scenario: JavaScript off
- **WHEN** the admin publishes a comment with JavaScript disabled
- **THEN** the comment is published and the list reloads without it

### Requirement: Comments service unreachable
When the comments service cannot be reached, the console's Comments page SHALL say so and SHALL not show an empty queue as if there were no comments.

#### Scenario: Service down
- **WHEN** the comments service does not answer
- **THEN** the Comments page shows "The comments service is unavailable" instead of "No pending comments"

### Requirement: Former admin page points to the console
While the comments service's own admin page remains, it SHALL show a notice at the top linking to the console, when a console address is configured.

#### Scenario: Open the old page
- **WHEN** the admin opens the comments service's admin page
- **THEN** a notice says moderation has moved, with a link to the console's Comments page
