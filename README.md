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

## Live Airtable mode

The portal ships with data baked in at build time (`app/lib/portal-data.json`),
but it can also read fresh data on every visit:

- `GET /api/portal-data` (server-only route, `revalidate = 60`) fetches all 8
  tables from Airtable using `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID` env vars
  (never `NEXT_PUBLIC_`-prefixed — the key never reaches the browser) and
  denormalizes through the same `lib/portal-transform.js` used at build time.
- The frontend tries `/api/portal-data` at runtime and silently falls back to
  the baked JSON if the route is unavailable, so the demo never goes blank.
  A "Live" badge in the header shows when live data is active.
- Set the two env vars in Vercel (Production) and redeploy — no code changes.
