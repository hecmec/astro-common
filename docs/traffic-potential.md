# Traffic potential of the four sites

Written on 2026-11-18. The question: which of the four sites (Alt Web, Simply Good Food, anglais-gratuit, bon-et-gratuit) can draw enough traffic to pay for the servers through donations or ads?

The traffic figures for other sites are third-party estimates (Semrush, Similarweb, Ahrefs). They disagree with each other and are only good for orders of magnitude. The estimates for our own sites are rules of thumb, not measurements. Replace them with real Umami figures (stats.babelcoach.com) when we have them: anglais-gratuit, live since February 2026, is the best calibration.

## Summary

- **Alt Web has the best odds** of reaching real traffic: the most pages, three languages, a growing topic and search queries that AI answers don't fully replace.
- **Simply Good Food has the highest ceiling** (largest market, best ad rates) **and the worst odds**: 86 recipes is far too few against Marmiton or Chefkoch.
- **The bar is low.** The four static sites run on one Coolify VPS (OVH), probably €10–30 a month in total (check the bill). About 15k pageviews a month on any one site, with sparse ads, covers it.

## The four sites in numbers

| | Alt Web | Simply Good Food | anglais-gratuit | bon-et-gratuit |
|---|---|---|---|---|
| Items (pages × languages) | 266 × 3 ≈ 800, plus 39 × 3 category pages | 86 × 3 = 258 | 121, French only | 97 (12 drafts), French only |
| Live since | November 2026 | October 2026 | February 2026 (oldest domain) | October 2026 |
| Biggest player in the niche | Utopia.de ~5M visits/month; european-alternatives.eu went from ~20k to 400–600k/month in 2025 | Marmiton ~40–45M, CuisineAZ ~20M, 750g ~6M (France only) | anglaisfacile.com ~0.4–0.9M | Dealabs ~21–25M, 82% of it direct traffic |
| Competition for a newcomer | Medium: mostly "X avis / Erfahrungen" and "alternative à X" queries | Brutal: big portals and food blogs with 1,000+ recipes each | Medium: "best resources" lists, which AI answers handle well | High: Dealabs lives on fresh daily deals and its community |
| Value of 1,000 pageviews (display ads) | Low to medium | Highest (food: $20–50 on US premium networks; much less in Europe with AdSense) | Medium (education, but students use ad blockers) | Lowest (the audience is looking for free things) |

## Why Alt Web comes first

1. **Most pages, and many of them answer brand searches.** A long-tail page on a young site gets roughly 5–30 visits a month after 12–18 months. At about 10 a page: Alt Web ≈ 9k visits a month, Simply Good Food ≈ 2.6k, anglais-gratuit ≈ 1.5k, bon-et-gratuit ≈ 1k. Alt Web also grows fastest (266 items in two weeks).
2. **AI answers hurt it the least.** In 2025 studies, AI Overviews cut clicks on informational queries by 35–61% (Ahrefs, Seer Interactive, Pew). "Best free sites to learn English" and "free things in France" are exactly the questions ChatGPT and Google now answer themselves. "Telecoop avis", "Enercoop Erfahrungen" or "alternative zu WhatsApp" still lead to clicks, because the reader is about to make a decision and wants details.
3. **The topic is growing.** european-alternatives.eu grew about 30-fold in 2025 on the "leave US big tech" wave. Alt Web covers that, in three languages, plus everyday consumption.

## How Alt Web can pay for itself

On 2026-11-18 Alt Web dropped its "nobody pays us to recommend anything" promise in favour of clearly marked affiliate links. It keeps the other half: no alternative can buy its place or its score. The rules are on the mission page ("Affiliate links") and explained in [affiliate-strategy.md](affiliate-strategy.md); in short, the page and scores come before any affiliate program, alternatives without a program are listed and sorted the same way, and the link leads to the same offer at the same price. An item gets one through the optional `affiliate_url` field, which the "Visit the website" button then uses, with `rel="sponsored"` and an "Affiliate link" note right under it.

Three sources, in order of expected income:

- **Affiliate links:** green electricity, ethical banking and telecom programs usually pay tens of euros per signed contract. 10k visits × 0.05% × about €40 ≈ **€200 a month**, assuming such programs exist for the alternatives we rate well; many cooperatives have none. Check broker rules (ORIAS in France) before linking to banks or insurers.
- **Sparse ads**, as the mission page allows: 10k visits × ~1.5 pages × about €2 per 1,000 pageviews ≈ **€30 a month**. That alone covers the servers.
- **Donations** through HelloAsso ([donation.md](../../alternative-web/docs/donation.md), the donate page). A charity's own website turns about 0.5% of its visitors into donors (M+R benchmarks). A directory should expect 10 to 50 times less: at 10k visits a month, roughly 1 to 5 donors. Donations only grow with a returning audience: a newsletter, the comments, and "no ads, no paid scores" as the pitch. BabelCoach can't issue tax receipts, so the French 66% tax reduction is no argument for now.

The main risk of affiliate links is choice bias over time: adding the alternatives that pay. Worth publishing, now and then, the share of alternatives that have one.

## The other three

- **Simply Good Food:** the largest market and the best ad rates, but recipe sites that rank have 500–1,000+ recipes, each with its own photos. Until then traffic will stay marginal. Worth it only as a long-term project; the meal-planner idea in [commercial-site-ideas.md](commercial-site-ideas.md) is the better way in.
- **anglais-gratuit:** the safest small earner. Oldest domain, stable demand, but French only, and AI answers handle "best resources" queries well. Realistic ceiling: a few thousand visits a month. Its real Umami numbers should be used to recalibrate every estimate in this document.
- **bon-et-gratuit:** huge search demand for "gratuit", but the least money per visitor, and people looking for free things rarely donate.

## Similar sites and ideas

- **To learn from or link to:** european-alternatives.eu (the closest model, and proof of what a wave can do), switching.software, Utopia.de, Good On You, Mes Courses pour la Planète, Transiscope. The full list is in the readme.
- **Cheap copies of existing code:** "apprendre l'allemand / l'espagnol gratuit" (smaller markets, almost no extra work), and German or English versions of anglais-gratuit and bon-et-gratuit. Simply Good Food shows the three-language setup works.
- **Tool pages hold up better than lists against AI answers:** a seasonal fruit and vegetable calendar ("légumes de saison novembre" comes back every month; fits Alt Web and Simply Good Food), or a calculator comparing a home-made dish's cost with the ready-made one.

## Risk

Publishing hundreds of pages in a few weeks is the pattern Google's scaled-content policy targets. The humanizer and AI-style checks help. Original screenshots, real comments and visible authorship help more.

## Recommendation

Put the effort into Alt Web, especially French and German pages on alternatives people search for by name. Add affiliate links where a well-rated alternative has a program, and sparse ads only if links and donations don't cover the servers. Keep the other three online at no extra cost, and recheck this document against real Umami data in spring 2027.

## Sources

- [OMR on Utopia.de](https://omr.com/de/utopia-ddvg-green-lifestyle-spd-nachhaltigkeit/), [Semrush utopia.de](https://tr.semrush.com/website/utopia.de/overview)
- [Similarweb, cuisineactuelle.fr competitors](https://www.similarweb.com/website/cuisineactuelle.fr/competitors), [Semrush marmiton.org](https://it.semrush.com/website/marmiton.org/competitors)
- [Semrush dealabs.com](https://semrush.com/website/dealabs.com/overview), [techlist, dealabs.com](https://techlist.ai/dealabs.com)
- [Semrush anglaisfacile.com](https://tr.semrush.com/website/anglaisfacile.com/overview), [Semrush alternativeto.net](https://tr.semrush.com/website/alternativeto.net/overview)
- [European Alternatives, press page](https://european-alternatives.eu/press)
- [Seer Interactive via PPC Land, AI Overviews and CTR](https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/), [eMarketer on the Ahrefs study](https://www.emarketer.com/content/google-ai-overviews-decrease-ctrs-by-34-5-per-new-study), [Pew via VideoWeek](https://videoweek.com/2025/07/23/pew-research-demonstrates-sharp-impact-of-ai-overviews-on-publisher-search-traffic/)
- [Ad RPM by niche](https://organicarbitrage.pages.dev/articles/display-ad-rpm-by-niche), [Mediavine vs Raptive RPM](https://organicarbitrage.pages.dev/articles/mediavine-vs-adthrive-vs-raptive)
- [Fundraise Up, nonprofit donation conversion](https://fundraiseup.com/blog/average-conversion-nonprofit/), [NextAfter benchmarks](https://benchmarks.nextafter.com/benchmark-yourself-results/)
