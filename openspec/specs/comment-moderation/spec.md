# comment-moderation Specification

## Purpose
Gives the single admin a place to review every new comment on the four sites, publish or refuse it, and answer published comments publicly.

## Requirements

### Requirement: Moderation queue
The admin page SHALL list pending comments of all sites, oldest first, each with its site, page link, language, author display name and email, date and text.

#### Scenario: Open the queue
- **WHEN** the admin opens the admin page
- **THEN** all pending comments are listed with a filter by site

### Requirement: Publish or refuse
The admin SHALL be able to publish or refuse a pending comment. Publishing SHALL make it visible to all readers of the page at once. A published comment SHALL be able to be unpublished (refused) later, and a refused one published later.

#### Scenario: Publish
- **WHEN** the admin publishes a pending comment
- **THEN** it appears under its page for every reader on their next load, and its publication date is recorded

#### Scenario: Refuse
- **WHEN** the admin refuses a pending comment
- **THEN** it leaves the queue and is visible only to its author, marked "Not published"

#### Scenario: Unpublish later
- **WHEN** the admin refuses a comment that was already published
- **THEN** it disappears from the widget at once and from baked pages at the next site build

### Requirement: Admin reply
The admin SHALL be able to add, edit or remove one public reply under a published comment, shown under it as a reply from the site.

#### Scenario: Reply
- **WHEN** the admin replies to a published comment
- **THEN** the reply appears under it, labelled with the site's name

### Requirement: History and search
The admin page SHALL also list published and refused comments, filterable by site, status and page.

#### Scenario: Find comments on a page
- **WHEN** the admin filters by a page path
- **THEN** every comment on that page is listed with its status

### Requirement: New-comment notification
The service SHALL email the admin about new comments, at most one email per 6 hours summarising the comments posted since the previous one, with a link to the queue.

#### Scenario: Several comments in a few hours
- **WHEN** three comments are posted within five hours
- **THEN** the admin receives one email listing all three

### Requirement: Sticky comments
The admin SHALL be able to mark a published comment sticky and remove the mark. A sticky comment SHALL keep its place by publication date and SHALL never be cut when its page has more comments than the page limit.

#### Scenario: Make a comment sticky
- **WHEN** the admin marks a published comment sticky
- **THEN** the admin page shows it as sticky, and it stays on its page however many newer comments follow

#### Scenario: Remove the mark
- **WHEN** the admin removes the sticky mark from a comment older than the page's 300 most recent
- **THEN** it is no longer shown on the page

### Requirement: Ban a reader
The admin SHALL be able to block a reader, after which that reader can no longer post comments or reactions, and their pending comments are refused.

#### Scenario: Blocked reader posts
- **WHEN** a blocked reader submits a comment
- **THEN** it is refused with a generic message
