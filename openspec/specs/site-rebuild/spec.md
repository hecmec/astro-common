# site-rebuild Specification

## Purpose
Keeps the comments baked into each site's static HTML up to date by rebuilding the sites' production apps once a night, only when their published comments or reactions changed.

## Requirements

### Requirement: Nightly rebuild of changed sites
Once a night, at a configured local time (default 03:30, Europe/Paris), the service SHALL trigger a rebuild of the production app of every configured site whose export changed since the last rebuild it triggered for that site, and SHALL trigger nothing for the other sites.

#### Scenario: A comment reaches the delay
- **WHEN** a comment published 7 days and a few hours ago is now in alt-web's export, and the nightly time passes
- **THEN** alt-web's production app is rebuilt once that night

#### Scenario: Nothing changed
- **WHEN** a site's export is the same as at its last triggered rebuild
- **THEN** no rebuild is triggered for that site

#### Scenario: Once a night
- **WHEN** the nightly time has passed and the check already ran that day
- **THEN** it does not run again before the next day, even after a restart of the service

### Requirement: What counts as a change
A site's export SHALL count as changed when its baked comments, their authors, texts and replies, or its reaction counts differ; the cutoff and generation dates alone SHALL not count.

#### Scenario: Only the cutoff moved
- **WHEN** a day passed and no comment crossed the delay, none was removed and no reaction changed
- **THEN** the site is not rebuilt

#### Scenario: A baked comment was removed
- **WHEN** a comment older than the delay was deleted or unpublished
- **THEN** the site is rebuilt that night

### Requirement: Configuration
A site SHALL be rebuilt only when `sites.yaml` names its production app, and only when the service has a Coolify URL and deploy token; without them the nightly rebuild SHALL be off and the service SHALL log that at startup.

#### Scenario: No token
- **WHEN** the service starts without a Coolify deploy token
- **THEN** it logs that the nightly rebuild is off and never calls Coolify

#### Scenario: Site without an app
- **WHEN** a site in `sites.yaml` has no production app
- **THEN** it is never rebuilt

### Requirement: Failures
A failed rebuild request SHALL be logged and shown on the admin page, and SHALL leave the site counted as changed, so the next run tries again.

#### Scenario: Coolify unreachable
- **WHEN** the deploy request fails
- **THEN** the admin page shows the failure for that site and the next nightly run requests the rebuild again

### Requirement: Admin controls
The admin page SHALL show, for each site, when its export was last checked, whether a rebuild was requested and the result, and SHALL offer a button that runs the check for all sites at once.

#### Scenario: Urgent removal
- **WHEN** the admin unpublishes an old comment and clicks "Rebuild changed sites now"
- **THEN** the site whose export changed is rebuilt right away and the page shows the request
