## Purpose

The Search page shows how the four sites do in Google Search, side by side: daily clicks or impressions in one chart and the searches that bring visitors, from Google Search Console.

## ADDED Requirements

### Requirement: One chart for the four sites
The Search page SHALL draw one line chart with one line per site, in the site's colour, with one point per day, on a shared vertical axis that starts at zero, from the sites' Google Search Console data.

#### Scenario: Open the page
- **WHEN** the admin opens Search
- **THEN** the chart shows the four sites' daily clicks from Google Search over the last 30 days with data

### Requirement: Ranges and data delay
The page SHALL offer three ranges: 7, 30 and 90 days. Each range SHALL end on the latest day for which Search Console has published data, and the page SHALL show that day and say that Search Console data arrives two to three days late. The chosen range SHALL be kept in the page address.

#### Scenario: Latest data is three days old
- **WHEN** today is 16 November and Search Console's latest day with data is 13 November
- **THEN** the 7-day range covers 7 to 13 November and the page says the data goes up to 13 November

### Requirement: Metrics
The page SHALL offer two metrics for the chart and totals: clicks and impressions. The chosen metric SHALL be kept in the page address.

#### Scenario: Impressions
- **WHEN** the admin switches to impressions
- **THEN** every line and total shows impressions for the same range

### Requirement: Exact values and totals
Each point SHALL show the site, the day and the value when the pointer rests on it. Under the chart, the page SHALL show each site's total for the range and metric, which also serves as the legend.

#### Scenario: Totals
- **WHEN** the range is 30 days and the metric is clicks
- **THEN** the totals row shows each site's clicks summed over those 30 days

### Requirement: Top searches
Below the chart, the page SHALL list the searches that brought the most clicks over the same range, up to 25, each with its site, clicks, impressions, click-through rate and average position, for all sites together or for one site chosen on the page. The choice of site SHALL be kept in the page address. The page SHALL say that Google leaves out rare searches for privacy, so the listed searches do not add up to the totals.

#### Scenario: All sites
- **WHEN** the admin opens Search without choosing a site
- **THEN** the table lists the top searches of the four sites together, each marked with its site, most clicks first

#### Scenario: One site
- **WHEN** the admin chooses Alt Web
- **THEN** the table lists only Alt Web's top searches, and the chart still shows the four sites

### Requirement: Works without client scripts
The chart, the range, metric and site choices, the values, the totals and the table SHALL work with JavaScript turned off.

#### Scenario: JavaScript off
- **WHEN** the admin opens Search with JavaScript disabled and picks another range
- **THEN** the page reloads with the chart, totals and table for the new range

### Requirement: Source failures
If one site's data cannot be read, the page SHALL show the other sites and a notice naming the missing site. If Search Console cannot be reached at all, or the console has no access configured, the page SHALL say "Search statistics are unavailable" instead of an empty chart.

#### Scenario: One property not shared with the console
- **WHEN** Search Console refuses access to Bon et gratuit's property and answers for the others
- **THEN** the chart shows three lines, the totals mark Bon et gratuit as unavailable, and a notice names it

#### Scenario: Not configured
- **WHEN** the console runs without Search Console credentials
- **THEN** the Search page says "Search statistics are unavailable"

### Requirement: Light on Search Console
The page SHALL show figures at most one hour old, and reloading within that time SHALL not send new requests to Search Console.

#### Scenario: Reload
- **WHEN** the admin reloads Search twice within a minute with the same range
- **THEN** Search Console receives requests only for the first load

### Requirement: Read-only access to Search Console
The console SHALL read Search Console with an account that has read-only access to the four properties, and SHALL never expose its key or access tokens to the browser.

#### Scenario: Page source
- **WHEN** the admin views the source of the Search page
- **THEN** it contains the figures but no key, token or service-account email
