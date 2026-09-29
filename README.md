# Tom's Table — demo client portal (portfolio piece)

Fictional meal-subscription service. Customer portal (`/`) + kitchen admin
dashboard (`/admin`). All data is fictional, baked in at build time from the
Airtable base — no API token ships to the browser.

## Data pipeline

1. `data/fetch_airtable.py` — pulls all 8 tables from base `appekb4SGVOMUeN8T`
   via the `custom.airtable` credential (skill: `~/workspace/skills/airtable/`)
   and caches raw JSON to `data/raw/`. Slow through the proxy (7–90s/call);
   run once, commit the cache.
2. `app/scripts/prepare-data.mjs` — runs on every `npm run build`; reads
   `data/raw/`, denormalizes links, writes `app/lib/portal-data.json`
   (menu, customers, orders, stats, fulfillment aggregates).

## Develop / build

```bash
cd app
npm install          # background it; never poll a long install
npm run build        # -> out/  (static export, output: 'export')
cd out && python3 -m http.server 8901   # preview
```

Screenshots: `../scripts/shot.mjs` (needs Chrome on :9223) and
`../scripts/shot-interact.mjs` (box-flow QA + mobile overflow check).
Headless Chrome: `~/workspace/.tools/chrome-linux64/chrome`.

## Design

Cream/terracotta/deep-green, Fraunces + Inter, card-based, mobile-first.
Meal art is deterministic inline SVG (`app/components/MealArt.jsx`) — no
external images. "Demo mode" badging on every surface; order flow is
client-side only.
