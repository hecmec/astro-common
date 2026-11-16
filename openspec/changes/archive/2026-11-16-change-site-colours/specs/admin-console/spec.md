## MODIFIED Requirements

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
