## Purpose

The Visits page shows the traffic of the four sites side by side in one chart, from the Umami statistics they already collect, so the admins can compare them and follow trends.

## ADDED Requirements

### Requirement: One chart for the four sites
The Visits page SHALL draw one line chart with one line per site, in the site's colour, with one point per day, on a shared vertical axis that starts at zero. Days are calendar days in Europe/Paris time.

#### Scenario: Open the page
- **WHEN** the admin opens Visits
- **THEN** the chart shows the four sites' daily visitors over the last 30 days

### Requirement: Ranges
The page SHALL offer three ranges: 7 days, 30 days and 90 days, each ending with today (today counted so far). The chosen range SHALL be kept in the page address, so it can be bookmarked and survives a reload.

#### Scenario: Switch range
- **WHEN** the admin picks 90 days
- **THEN** the chart shows 90 daily points per site ending today, and the address shows the range

### Requirement: Metrics
The page SHALL offer two metrics: visitors (Umami's visits) and pageviews. The chosen metric SHALL be kept in the page address. The page SHALL say in a short note how Umami counts visits, so the total over a period is not read as a number of distinct people.

#### Scenario: Pageviews
- **WHEN** the admin switches to pageviews
- **THEN** every line and total shows pageviews for the same range

### Requirement: Exact values and totals
Each point SHALL show the site, the day and the value when the pointer rests on it. Under the chart, the page SHALL show each site's total for the range and metric, in the site's colour, which also serves as the chart's legend.

#### Scenario: Hover a point
- **WHEN** the admin rests the pointer on Alt Web's point for 12 November
- **THEN** a label shows "Alt Web, 12 Nov" with that day's value

#### Scenario: Totals
- **WHEN** the range is 7 days and the metric is visitors
- **THEN** the totals row shows each site's visits summed over those 7 days

### Requirement: Works without client scripts
The chart, the range and metric choices, the values and the totals SHALL work with JavaScript turned off.

#### Scenario: JavaScript off
- **WHEN** the admin opens Visits with JavaScript disabled and picks another range
- **THEN** the page reloads with the new range and the chart and totals for it

### Requirement: Source failures
If the statistics of one site cannot be read, the page SHALL show the other sites and a notice naming the missing site. If Umami cannot be reached at all, the page SHALL say so instead of drawing an empty chart.

#### Scenario: One site fails
- **WHEN** Umami answers for three sites and fails for bon-et-gratuit
- **THEN** the chart shows three lines, the totals row marks bon-et-gratuit as unavailable, and a notice names it

#### Scenario: Umami down
- **WHEN** Umami does not answer
- **THEN** the page shows "Visit statistics are unavailable" and no chart

### Requirement: Fresh enough, light on Umami
The page SHALL show figures at most 5 minutes old. Reloading the page within that time SHALL not send new requests to Umami.

#### Scenario: Reload
- **WHEN** the admin reloads Visits twice within a minute with the same range and metric
- **THEN** Umami receives requests only for the first load

### Requirement: Read-only access to statistics
The console SHALL read the statistics with an Umami account that can only view, and SHALL never expose its credentials or Umami tokens to the browser.

#### Scenario: Page source
- **WHEN** the admin views the source of the Visits page
- **THEN** it contains the figures but no Umami credential or token
