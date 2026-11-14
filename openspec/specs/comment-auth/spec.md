# comment-auth Specification

## Purpose
Lets readers of the BabelCoach sites sign in with Google or an emailed link so they can comment and react, and identifies the single admin who moderates.

## Requirements

### Requirement: Sign in with Google
The service SHALL let a reader sign in with a Google account, accepting only accounts whose email Google reports as verified.

#### Scenario: Successful Google sign-in
- **WHEN** a reader clicks "Sign in with Google" in the widget and completes Google's consent
- **THEN** the widget shows the reader as signed in under their display name, without reloading the page

#### Scenario: Unverified Google email
- **WHEN** Google returns an account whose email is not verified
- **THEN** sign-in is refused with a message suggesting the email link instead

### Requirement: Sign in with an email link
The service SHALL let a reader sign in by entering an email address and opening a single-use link sent to it, valid for 15 minutes.

#### Scenario: Link opened in time
- **WHEN** the reader opens the link within 15 minutes of requesting it
- **THEN** the reader is signed in on the page where they started

#### Scenario: Link opened on another device
- **WHEN** the reader opens the link on a different device or browser than the page
- **THEN** the page where they started becomes signed in, and the device that opened the link shows that they can return to the page

#### Scenario: Expired or reused link
- **WHEN** the reader opens a link older than 15 minutes or already used
- **THEN** no sign-in happens and they are offered to request a new link

### Requirement: Sign-in works without third-party cookies
Signing in and staying signed in on a site SHALL work in browsers that block third-party cookies (current Safari, Firefox and Chrome).

#### Scenario: Safari with default settings
- **WHEN** a reader on Safari signs in on one of the sites and reloads the page
- **THEN** they are still signed in

### Requirement: Sessions are per site and revocable
A session SHALL be valid only on the site where it was created, SHALL expire after 90 days, and SHALL end when the reader signs out.

#### Scenario: Token used on another site
- **WHEN** a session created on one site is presented by another site
- **THEN** the service rejects it as not signed in

#### Scenario: Sign out
- **WHEN** a reader clicks "Sign out"
- **THEN** the session is invalidated on the server and the widget shows the sign-in buttons

### Requirement: Display name
On first sign-in the reader SHALL choose a display name (2 to 40 characters), which is the only identity shown publicly. The email address SHALL never be shown to other readers or in any public API response.

#### Scenario: First sign-in
- **WHEN** a reader signs in for the first time
- **THEN** they are asked for a display name before they can comment

#### Scenario: Public data
- **WHEN** anyone reads published comments through the widget or the API
- **THEN** responses contain display names and no email addresses

### Requirement: Account deletion
A signed-in reader SHALL be able to delete their account, choosing whether their published comments are deleted or kept under the name "Former reader".

#### Scenario: Delete account and comments
- **WHEN** a reader deletes their account and chooses to delete their comments
- **THEN** their email, sessions, reactions and comments are removed, and their comments disappear from the widget at once and from baked pages at the next site build

### Requirement: Single admin
The service SHALL grant the admin role only to the account signed in with Google under the configured admin email address.

#### Scenario: Admin signs in
- **WHEN** the configured admin signs in with Google on the admin page
- **THEN** the moderation queue is shown

#### Scenario: Anyone else
- **WHEN** any other account opens the admin page
- **THEN** access is refused
