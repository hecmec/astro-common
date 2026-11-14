# page-comments Specification

## Purpose
Lets signed-in readers leave a text comment on a page of one of the BabelCoach sites, and shows published comments under that page in a "Your reactions, your comments" section.

## Requirements

### Requirement: Allowed domains
The service SHALL keep an explicit list of the domains allowed to embed it, each attached to one site. It SHALL accept widget requests and sign-ins only from pages on a listed domain, and only for the site that domain belongs to. Local development origins SHALL be accepted only when the service is explicitly started in development mode.

#### Scenario: Unlisted domain
- **WHEN** a page on a domain that is not in the list loads the widget
- **THEN** the API refuses its requests, no sign-in can start, and the widget shows nothing

#### Scenario: Domain of another site
- **WHEN** a page on alt-web's domain sends requests for the simplygoodfood site
- **THEN** the API refuses them

#### Scenario: Adding a domain
- **WHEN** the admin adds a domain to the list and redeploys the service
- **THEN** pages on that domain can use the service

#### Scenario: Same domain twice
- **WHEN** the list attaches one domain to two sites
- **THEN** the service refuses to start and names the domain

### Requirement: Page identity
Comments SHALL belong to a page identified by its site and URL path. Query strings and fragments SHALL be ignored, a missing trailing slash SHALL be treated as present, and each language version of a page SHALL be a separate page.

#### Scenario: Same page with a query string
- **WHEN** a comment is posted from `/tag/vrac/?utm_source=x`
- **THEN** it belongs to the page `/tag/vrac/`

#### Scenario: Language versions
- **WHEN** a comment is posted on `/fr/x/`
- **THEN** it does not appear on `/x/` or `/de/x/`

### Requirement: Post a comment
A signed-in reader SHALL be able to post a plain-text comment of 1 to 500 characters on the page they are reading. The comment SHALL be stored as pending and not shown to other readers until published.

#### Scenario: Successful post
- **WHEN** a signed-in reader submits a comment
- **THEN** it appears to them under the page marked "Awaiting moderation", and other readers do not see it

#### Scenario: Not signed in
- **WHEN** a reader who is not signed in tries to comment
- **THEN** the widget offers the sign-in options instead of the comment form

#### Scenario: Too long or empty
- **WHEN** a comment is empty or longer than 500 characters
- **THEN** it is refused with a message giving the limit

### Requirement: At most 300 comments per page
A page SHALL show at most its 300 most recently published comments, plus every comment the admin has marked sticky, most recent first. The limit SHALL apply to the page as a whole, baked and live comments together. A reader's own pending or refused comments SHALL not count against it.

#### Scenario: Page with more than 300 comments
- **WHEN** a page has 310 published comments and none is sticky
- **THEN** it shows the 300 most recently published, the most recent at the top

#### Scenario: Sticky comment older than the last 300
- **WHEN** a page has 310 published comments and the admin has marked the 4th oldest sticky
- **THEN** it shows 301 comments, the sticky one in its place by date, at the bottom after the others

#### Scenario: Sticky comment among the last 300
- **WHEN** a sticky comment is already among the 300 most recent
- **THEN** it is shown once and the page shows 300 comments

### Requirement: Rate limits
The service SHALL refuse a reader's comment when they have posted 10 comments in the last hour or have 30 comments pending.

#### Scenario: Limit reached
- **WHEN** a reader posts an eleventh comment within an hour
- **THEN** it is refused with a message asking them to try later

### Requirement: Reader sees the status of their own comments
A signed-in reader SHALL see their own pending and refused comments on the page where they posted them, with their status. Refused comments SHALL be visible only to their author.

#### Scenario: Refused comment
- **WHEN** the admin refuses a comment
- **THEN** its author sees it marked "Not published" on the page, and no one else sees it

### Requirement: Delete own comment
A reader SHALL be able to delete any of their own comments.

#### Scenario: Delete published comment
- **WHEN** a reader deletes one of their published comments
- **THEN** it disappears from the widget at once and from the baked page at the next site build

### Requirement: Comments section display
Under a page, the widget SHALL show a section titled "Your reactions, your comments" (in the page's language: English, French or German) with the page's reactions, then the sign-in options or the comment form, then its published comments most recent first (the newest at the top, the oldest at the bottom), each with its display name, date and any admin reply.

#### Scenario: French page
- **WHEN** the widget loads on a page whose `lang` is `fr`
- **THEN** all its labels are in French

#### Scenario: German page
- **WHEN** the widget loads on a page whose `lang` is `de`
- **THEN** its labels address the reader formally ("Sie"), like the German sites, and so do the sign-in popup and the emails

#### Scenario: Comment sent
- **WHEN** a reader sends a comment
- **THEN** a confirmation that it will appear once read is shown, styled as a confirmation and not like an input field

#### Scenario: Page without comments
- **WHEN** a page has no published comments
- **THEN** the section shows the reactions and an invitation to be the first to comment

### Requirement: Safe rendering
Comment text SHALL be shown as plain text: no HTML is interpreted, line breaks are kept, and URLs are shown as links marked `nofollow ugc` that open in a new tab.

#### Scenario: HTML in a comment
- **WHEN** a comment contains `<script>alert(1)</script>`
- **THEN** it is displayed literally and nothing is executed

### Requirement: Service outage does not break pages
If the service cannot be reached, the page SHALL still render normally, with any baked comments, and the widget SHALL show no error beyond a short "Comments are unavailable right now" line.

#### Scenario: Service down
- **WHEN** the widget's requests fail or time out
- **THEN** baked comments stay visible and the form area shows the unavailable notice
