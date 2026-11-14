# page-reactions Specification

## Purpose
Lets signed-in readers give a quick one-click reaction to a page, with public counts, as a lighter form of feedback than a comment.

## Requirements

### Requirement: Reaction kinds per site
Each site SHALL have a fixed, configured set of reaction kinds (for example "Useful", "I tried it", "I disagree"), each with a label in English, French and German and an icon.

#### Scenario: Site-specific reactions
- **WHEN** the widget loads on a page of a site
- **THEN** it shows that site's reaction kinds, labelled in the page's language

### Requirement: React to a page
A signed-in reader SHALL be able to toggle each reaction kind on a page, at most once per kind. Reactions SHALL be counted immediately, without moderation.

#### Scenario: Add a reaction
- **WHEN** a signed-in reader clicks "Useful" on a page
- **THEN** the "Useful" count increases by one and the button shows as selected for them

#### Scenario: Remove a reaction
- **WHEN** the reader clicks a reaction they already selected
- **THEN** it is removed and the count decreases by one

#### Scenario: Not signed in
- **WHEN** a reader who is not signed in clicks a reaction
- **THEN** the counts do not change and the sign-in options are shown

### Requirement: Public counts
Anyone SHALL see the count of each reaction kind on a page once it is at least 1 (a kind nobody chose shows its label without a number); who reacted SHALL not be public.

#### Scenario: Anonymous visitor
- **WHEN** a visitor who is not signed in loads a page
- **THEN** they see the reaction counts and no names

#### Scenario: Kind nobody chose
- **WHEN** no reader has chosen "I use it" on a page
- **THEN** its button shows the label without a count
