# admin-console Specification

## Purpose
The admin console is one web application where the BabelCoach admins run the four sites together: it gives sign-in, a menu of features and a shared list of the sites.

## Requirements

### Requirement: Sign-in with Google and an allow-list
The console SHALL require a Google sign-in on every page except its sign-in pages and its health check. It SHALL let in only accounts whose verified Google email is in the configured list of admin emails. A session SHALL last 30 days unless the admin signs out.

#### Scenario: Admin signs in
- **WHEN** an account in the admin list signs in with Google
- **THEN** the console opens on the Comments page

#### Scenario: Other account
- **WHEN** an account that is not in the admin list signs in with Google
- **THEN** access is refused with a message naming the account, and no session is created

#### Scenario: Not signed in
- **WHEN** someone who is not signed in opens any console page
- **THEN** they are sent to the sign-in page, and after signing in they land on the page they asked for

#### Scenario: Sign out
- **WHEN** the admin clicks "Sign out"
- **THEN** the session ends and the next page asks for sign-in again

### Requirement: Session cannot be forged or replayed after expiry
The session SHALL be held in a cookie that the browser's scripts cannot read and that is sent over HTTPS only in production. The console SHALL reject a cookie that has been altered, has expired, or was issued under a previous session secret.

#### Scenario: Altered cookie
- **WHEN** a request carries a session cookie whose content was changed
- **THEN** the console treats the request as not signed in

#### Scenario: Secret rotated
- **WHEN** the session secret is changed and the console restarts
- **THEN** every existing session is refused and the admins sign in again

### Requirement: Actions only from the console's own pages
The console SHALL refuse any state-changing request that does not come from one of its own pages.

#### Scenario: Cross-site form
- **WHEN** a page on another site submits a form to a console action with the admin's cookie
- **THEN** the console refuses it with 403 and changes nothing

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

### Requirement: The four sites
The console SHALL know the same sites as the comments service, each with a name, a colour and its public address. Each site SHALL keep its colour everywhere the console shows it (badges, chart lines, totals). Each site SHALL have a colour for the light theme and one for the dark theme: lime for Anglais gratuit, broccoli green for Simply Good Food, bordeaux red for Alt Web and blue for Bon et gratuit. In each theme, every pair of site colours SHALL be distinguishable for people with common colour-vision deficiencies (protanopia, deuteranopia, tritanopia) and with normal vision, and every colour SHALL be readable on the console's background: at least 3:1 contrast, or at least 2:1 where the site's name is also shown next to its line and in the totals.

#### Scenario: Same sites as the comments service
- **WHEN** a site is added to the comments service but not to the console's site list
- **THEN** the console's tests fail

#### Scenario: Two lines cross
- **WHEN** the lines of any two sites cross in the Visits chart, in the light or the dark theme
- **THEN** their colours stay distinguishable, also for a reader with a red-green or blue-yellow colour-vision deficiency

#### Scenario: A colour too close to another
- **WHEN** a site colour is changed to one that a colour-vision deficiency would confuse with another site's colour, or that is too faint on a background
- **THEN** the console's tests fail

### Requirement: Health check
The console SHALL answer a health check without sign-in, which succeeds when the console runs, whatever the state of the comments service and Umami.

#### Scenario: Sources down
- **WHEN** Umami and the comments service are unreachable
- **THEN** the health check still succeeds
