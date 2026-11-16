# comment-admin-api Specification

## Purpose
The comments service's admin API lets the admin console moderate comments and run site rebuilds from its own server, with the same effects as the comments service's own admin page.

## Requirements

### Requirement: Server-to-server authentication
The admin API SHALL answer only requests that carry the configured console token as a bearer token. Requests without it or with a wrong token SHALL get 401 and change nothing. When no console token is configured, the admin API SHALL not exist (404). The API SHALL send no cross-origin headers, so browsers cannot call it from a web page.

#### Scenario: Right token
- **WHEN** the console calls the admin API with the configured token
- **THEN** the request is served

#### Scenario: Wrong token
- **WHEN** a request carries another token or none
- **THEN** it gets 401 and nothing changes

#### Scenario: Not configured
- **WHEN** the service runs without a console token
- **THEN** every admin API path answers 404

### Requirement: Summary
The admin API SHALL return, for each site and for all sites together, the number of pending, published and refused comments.

#### Scenario: Counts
- **WHEN** alt-web has 2 pending comments and simplygoodfood 1
- **THEN** the summary gives 2 for alt-web, 1 for simplygoodfood and 3 for all sites as pending

### Requirement: Comment list
The admin API SHALL list comments filtered by status (default pending) and optionally by site and page path, with, for each comment: its id, site, page path and full page address, language, date, author display name, email and reader id, whether the reader is blocked, whether it is sticky, its text and its public reply. Pending comments SHALL be listed oldest first; published and refused ones newest first. The list SHALL come with the counts per status for the same site and page filter.

#### Scenario: Pending of one site
- **WHEN** the console asks for pending comments of alt-web
- **THEN** it receives alt-web's pending comments, oldest first, and the counts of pending, published and refused comments of alt-web

#### Scenario: Unknown site
- **WHEN** the console asks for a site that does not exist
- **THEN** it gets 400

### Requirement: Moderation actions
The admin API SHALL let the console publish, refuse (or unpublish) a comment, mark it sticky or remove the mark, set, change or remove its public reply, and block or unblock a reader. Each action SHALL have the same effect as the same action on the comments service's admin page, and SHALL answer with the comment's new state. An action on a comment that does not exist SHALL get 404. Marking sticky or replying to a comment that is not published SHALL get 409.

#### Scenario: Publish through the API
- **WHEN** the console publishes a pending comment
- **THEN** the comment is published with its publication date recorded, and readers see it on their next load

#### Scenario: Reply to a pending comment
- **WHEN** the console sends a reply for a comment that is still pending
- **THEN** it gets 409 and nothing changes

#### Scenario: Block a reader
- **WHEN** the console blocks a reader
- **THEN** the reader can no longer post and their pending comments are refused

### Requirement: Rebuild status and run
The admin API SHALL return, for each site with a configured rebuild, its last check time, its result (rebuild requested, unchanged, or failed with the error), and the time of the nightly check, or say that rebuilds are off. It SHALL also let the console run the check for all sites at once, answering with the new status.

#### Scenario: Rebuilds off
- **WHEN** the service runs without the Coolify settings
- **THEN** the rebuild status says rebuilds are off

#### Scenario: Run now
- **WHEN** the console asks to run the check after an old comment was unpublished
- **THEN** the site whose export changed is rebuilt and the answer shows the request
