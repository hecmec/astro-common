# Affiliate strategy

Written on 2026-11-18, when Alt Web replaced its promise "nobody pays us to recommend anything" with clearly marked affiliate links. Why, under which rules, how it works on the site, and what to watch. The traffic and income estimates behind the decision are in [traffic-potential.md](traffic-potential.md).

This is not legal advice. Check the points marked below before relying on them.

## Why

Display ads at about €2 per 1,000 pageviews would bring roughly €30 a month at 10k visits, and donations to a directory site are rare (1 to 5 donors a month at that traffic). An affiliate contract for green electricity, an ethical bank or a telecom cooperative usually pays tens of euros. At 10k visits, 0.05% conversion and about €40 a contract, that is about €200 a month: the only source that could pay for more than the servers.

The site was two weeks old when we changed the promise, so few readers had seen the old one. Changing it later would have cost more trust.

## The promise we keep

We dropped "nobody pays us to recommend anything". We keep, and repeat in the home intro, the footer, the mission page and the donate page: **no alternative can buy its place or its score.**

That sentence is the selling point, and it is also what the law requires. Since the EU Omnibus directive (2019/2161), a ranking influenced by payment without saying so counts as an unfair commercial practice. Alt Web sorts its lists by score, so the scores must stay independent of any commission.

## The three rules

They are published on the mission page, section "Affiliate links" ("Liens affiliés", "Werbelinks"):

1. **Review first, program second.** We write an alternative's page and give its scores before we look for an affiliate program. A commission never changes the text, the scores or the order of the lists.
2. **No program, no penalty.** An alternative without an affiliate program is listed and sorted exactly like one with a program. Many of the best alternatives, such as small cooperatives, have none.
3. **Same offer, same price.** An affiliate link leads to the same offer as the plain link. If a program makes the offer more expensive for the reader, we don't use it.

## Labelling

Affiliate links must be clearly marked, in France, Germany and the UK alike. A footer note alone is not enough: the label has to be right next to the link.

- A visible label under the "Visit the website" button, with one sentence on what it means and a link to the rules:
  - en: **Affiliate link.** If you sign up or buy through it, {name} pays us a commission. It costs you nothing extra and doesn't change the scores.
  - fr: **Lien affilié.** Si vous vous inscrivez ou achetez par ce lien, {name} nous verse une commission…
  - de: **Werbelink (Affiliate-Link).** Wenn Sie über diesen Link buchen oder kaufen, zahlt uns {name} eine Provision… German case law expects the word "Werbung" or a clear equivalent, hence "Werbelink" first.
- `rel="sponsored"` on the link, as Google requires for paid links.
- Where the site says it has no ads, the German text says "Werbeanzeigen" (ad banners), so it doesn't contradict the Werbelinks.

## How it works on the site

An alternative gets an affiliate link through one optional frontmatter field:

```yaml
url: https://example.org
affiliate_url: https://example.org/?ref=altweb
```

- The "Visit the website" button opens `affiliate_url`, with `rel="sponsored noopener"`, and shows the label and note under it (`src/pages/[...lang]/alternatives/[slug].astro`, strings `item.affiliate`, `item.affiliateNote`, `item.affiliateMore` in `src/i18n/ui.ts`).
- The gallery image and the structured data keep the plain `url`.
- Without `affiliate_url`, nothing changes: the button opens `url` with `rel="noopener noreferrer"`.
- The note links to `/mission/#affiliate-links` (and `/fr/…`, `/de/…`).

## Before adding a link

- The page and its scores are written and published without the link (rule 1).
- The program doesn't raise the price for the reader (rule 3).
- **Banks, insurance and credit:** in France, being paid for referring people to them can require registration as an intermediary (ORIAS, IOBSP or insurance intermediary). Check before adding an affiliate link to one. Germany has comparable rules (§ 34c/§ 34d GewO).
- The program's own terms allow a non-profit directory and our labelling.

## Risks and guards

- **Choice bias.** The real risk is not a bought score but a slow drift: adding the alternatives that pay and putting off the ones that don't. Guards: rule 2, publishing from time to time the share of alternatives that have an affiliate link, and keeping scores that can be traced from the page text (strengths and weaknesses explain the score).
- **Brand.** "Nobody pays us" was what set Alt Web apart from sites like Utopia.de, which live on affiliate links and ads. The new position is "honest, and open about how we earn money". It holds as long as the rules are followed visibly.
- **Donations.** The donate page now says the site lives on donations and on a few marked affiliate links. Donations still matter: the more they bring, the fewer links we need.

## Where this was changed (in alternative-web)

- `src/content.config.ts`: the `affiliate_url` field.
- `src/pages/[...lang]/alternatives/[slug].astro`: button, label and note.
- `src/i18n/ui.ts`: home intro, footer and the three affiliate strings, in en, fr and de.
- `src/content/pages/{,fr/,de/}mission.md` and `donate.md`: the "Who pays for this" text and the rules.
- `CLAUDE.md`, [traffic-potential.md](traffic-potential.md), [commercial-site-ideas.md](commercial-site-ideas.md).
