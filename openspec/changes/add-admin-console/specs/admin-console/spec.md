## Purpose

The admin console is one web application where the BabelCoach admins run the four sites together: it gives sign-in, a menu of features and a shared list of the sites.

## ADDED Requirements

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
Every console page SHALL show a left menu with the console's features (in this version: Comments and Visits), the signed-in account and a sign-out button. The Comments entry SHALL show the number of pending comments of all sites, and no number when there are none. On narrow screens the menu SHALL fold behind a button.

#### Scenario: Pending comments
- **WHEN** four comments are pending across the sites
- **THEN** the Comments menu entry shows 4 on every console page

#### Scenario: Comments service unreachable
- **WHEN** the comments service does not answer
- **THEN** the menu shows the Comments entry without a number, and the other pages still work

### Requirement: The four sites
The console SHALL know the same sites as the comments service, each with a name, a colour and its public address. Each site SHALL keep its colour everywhere the console shows it (badges, chart lines, totals). The colours SHALL be distinguishable from one another for people with common colour-vision deficiencies and readable on the console's light and dark backgrounds.

#### Scenario: Same sites as the comments service
- **WHEN** a site is added to the comments service but not to the console's site list
- **THEN** the console's tests fail

### Requirement: Health check
The console SHALL answer a health check without sign-in, which succeeds when the console runs, whatever the state of the comments service and Umami.

#### Scenario: Sources down
- **WHEN** Umami and the comments service are unreachable
- **THEN** the health check still succeeds
