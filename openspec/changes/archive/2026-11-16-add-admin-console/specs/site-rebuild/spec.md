## MODIFIED Requirements

### Requirement: Admin controls
The console's Comments page SHALL show, for each site, when its export was last checked, whether a rebuild was requested and the result, and SHALL offer a button that runs the check for all sites at once. The comments service's own admin page SHALL keep the same controls while it remains.

#### Scenario: Urgent removal
- **WHEN** the admin unpublishes an old comment and clicks "Rebuild changed sites now" in the console
- **THEN** the site whose export changed is rebuilt right away and the page shows the request

#### Scenario: Rebuilds off
- **WHEN** the comments service runs without the Coolify settings
- **THEN** the console shows that site rebuilds are off and offers no button
