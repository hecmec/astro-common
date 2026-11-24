# Car fan site

A first sketch, written on 2026-11-24, of a fan site about modern cars in English, French and German, built like the shoe and recipe sites. It also keeps the research on where to find photos that a public site may use.

## Photos

Carmakers publish free photos, but only for journalists writing about their cars, not under an open licence. For a fan site, the reliable sources are Wikimedia Commons, the free stock sites and our own photos.

### 1. Carmakers' press sites: free, but "editorial use only"

Every big brand has a press portal with high-resolution photos of current models: BMW PressClub, the Volkswagen Newsroom, Mercedes-Benz media, Stellantis media, the Renault Group press site. The licence is the catch:

- **BMW** labels its photos "free for editorial use", and Rolls-Royce (part of BMW) says "for editorial purposes only" ([photo example](https://www.press.bmwgroup.com/united-kingdom/photo/detail/P90613231/FREE-FOR-EDITORIAL-USE-BMW-Proactive-Care-Sand-Sculpture), [legal notice](https://www.press.bmwgroup.com/new-zealand/info/legal)). Downloading usually needs a PressClub account, and BMW can change the terms at any time.
- **Volkswagen**: the only reuse terms found cover historical images. They allow one free media use with the credit "Volkswagen Aktiengesellschaft", no changes and no passing on ([terms](https://www.volkswagen-newsroom.com/de/nutzungsbedingungen-fuer-historische-bilder-18017)). No published terms were found for current press photos.
- **Renault**: the site terms allow strictly personal use only and exclude commercial and informational use ([legal notice](https://www.renault.fr/mentions-legales.html)). The heritage archive says its images are not royalty-free ([Renault Heritage terms](https://heritage.group.renault.com/renault-patrimoine/doc/FR/MentionsLegales.pdf)). No open licence was found for press photos.

A non-commercial fan site describing the cars is close to "editorial" use, and brands rarely mind fans using press photos with a credit. That is still not a licence: the brand can ask for the photos to be removed, and ads or affiliate links would clearly go beyond editorial use. The clean way is to email the brand's press office and ask; they often say yes. Keep the answer (date, person, what was allowed) in `data/image-credits.yaml`.

### 2. Wikimedia Commons: the best free source

Commons has thousands of photos of modern cars, mostly under CC BY-SA: free to use, with a credit, and changes under the same licence. Many come from car shows. Alexander Migl, for example, photographed the IAA in Frankfurt and Munich, partly in a project supported by Wikimedia Deutschland ([example](https://commons.wikimedia.org/wiki/File:Michelin_at_IAA_2021_1X7A0161.jpg)).

- Search the model name ("VW ID.3", "Renault 5 E-Tech") or a show ("IAA 2023", "Mondial de l'Automobile 2024"); there are usually several angles.
- Check the licence on the original commons.wikimedia.org page, not on a mirror site.
- Simply Good Food's `scripts/commons-photo.mjs` searches, downloads, crops and records the credit. It would work almost unchanged here.

### 3. Pixabay, Pexels and Unsplash

Plenty of modern cars, free to use without credit. Coverage is patchy (many Porsches and Teslas, few Dacias), and the tags are often wrong, so check the model on every photo. Simply Good Food's `scripts/fetch-images.mjs` already queries Pixabay and Pexels.

### 4. Our own photos

Probably the best source: car shows, dealers' showrooms, car meets, the street. The photos are ours, nobody can ask for them to be removed, and real photos make the site stand out. Photographing a car and naming its brand is fine. Leave faces out, and blur number plates to be safe.

### Rule for the site

Start with Commons and our own photos, credit every Commons photo next to the image and in `data/image-credits.yaml`, and use press photos only for a few new models after the brand has said yes. Never take product photos from retailers' or carmakers' shops: the shoe site did that and every one of those images has to be replaced before it can go public (see `simi-running-shoes/docs/image-sources.md`).

## The site

### Idea

One card per car model, browsable by category, with the facts a fan wants to compare and a short opinion. Same structure as the other sites: cards, category pages, a page per model, three languages (English without prefix, `/fr/`, `/de/`), Astro + Tailwind, built from this repository's shared code.

### Categories (first draft)

City cars, compact cars, family cars and estates, SUVs, vans and people carriers, sports cars, supercars, electric cars, hybrids, off-roaders and pick-ups, classics (still sold or recently stopped), concept cars.

Electric, hybrid and the body type are better as filters than as categories, so a car can be both "SUV" and "electric".

### A model page

`src/content/cars/<id>.md`, English, with frontmatter and a short body, translations in `fr/` and `de/`. The values in the example column show the format only and have not been checked.

| Field | Example |
|---|---|
| `brand`, `model`, `generation` | Renault, 5 E-Tech, 1st generation |
| `years` | 2024– |
| `main_category`, `secondary_categories` | city cars; electric cars |
| `body` | hatchback, saloon, estate, SUV, coupé, convertible, van, pick-up |
| `energy` | petrol, diesel, hybrid, plug-in hybrid, electric, hydrogen |
| `power_kw`, `top_speed_kmh`, `zero_to_100_s` | 110, 150, 8.0 |
| `range_km` (electric) or `consumption` | 410 (WLTP) |
| `length_mm`, `weight_kg`, `seats` | 3922, 1450, 5 |
| `price_from` with its country and date | €33,490, France, 2026-11 |
| `made_in`, `brand_country` | France, France |
| `fan_rating` | looks, fun to drive, practicality, each N/5 |
| `thumbnail`, `images` | from Commons or our own photos |
| `predecessor`, `similar` | model ids, as `modele_precedent` and `chaussures_similaires` on the shoe site |
| `sources` | the carmaker's spec page, the Wikipedia article |

Body sections: Description / What we like / What we like less / Who it is for, like the other sites. The first paragraph is the card text.

### Pages that bring visitors

- Brand pages: every model of a brand, with its country and history in a few lines.
- Comparisons: "Renault 5 vs Peugeot e-208", built from two model pages.
- Rankings computed from the data: fastest, longest range, lightest, cheapest electric car.
- A quiz or "which car am I?" page for fun.

### Start small

Begin with 20 to 30 models that have good Commons photos, in one language, then add the translations. Facts come from the carmaker's spec pages and Wikipedia, with the sources listed on each page. Prices change, so show their date.

### Open questions

- Name and domain.
- Non-commercial fan site, or ads and affiliate links later? Affiliate links rule out press photos without written permission.
- Who writes the opinions, and whether visitors can vote (the shared comments section already exists).
