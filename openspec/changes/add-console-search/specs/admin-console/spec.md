## MODIFIED Requirements

### Requirement: Feature menu
Every console page SHALL show a left menu with the console's features (Comments, Visits and Search), the signed-in account and a sign-out button. The Comments entry SHALL show the number of pending comments of all sites, and no number when there are none. On narrow screens the menu SHALL fold behind a button.

#### Scenario: Pending comments
- **WHEN** four comments are pending across the sites
- **THEN** the Comments menu entry shows 4 on every console page

#### Scenario: Comments service unreachable
- **WHEN** the comments service does not answer
- **THEN** the menu shows the Comments entry without a number, and the other pages still work

#### Scenario: Search in the menu
- **WHEN** the admin opens any console page
- **THEN** the menu offers Search after Visits, marked as the current page on the Search page
