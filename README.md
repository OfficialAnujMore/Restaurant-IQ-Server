# RestaurantIQ

**ArcGIS-powered location intelligence for restaurant site selection.**
Pick a city, pick a cuisine, pick a strategy — RestaurantIQ scores a grid of candidate locations across demographics, foot traffic, anchor proximity, and competitor density, then ranks the top 5 spots and visualizes them on an interactive map.

---

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- An ArcGIS Developer API key — [developers.arcgis.com](https://developers.arcgis.com/)

---

## Setup

```bash
git clone <repo> restaurantiq && cd restaurantiq
```

### Server

```bash
cd server
npm install
```

Create `server/.env`:

```
ARCGIS_API_KEY=your_arcgis_api_key_here
MONGO_URI=your_mongodb_connection_string_here
PORT=5000
```

Start:

```bash
npm run dev
```

### Client

```bash
cd ../client
npm install
```

Create `client/.env`:

```
VITE_ARCGIS_API_KEY=your_arcgis_api_key_here
```

Start:

```bash
npm run dev
```

The Vite dev server proxies `/api/*` → `http://localhost:5000`.

> **macOS note:** port 5000 is used by AirPlay Receiver. Either disable it (System Settings → General → AirDrop & Handoff) or change `PORT` in `server/.env` and update the proxy target in `client/vite.config.js`.

---

## How to use

1. Enter a city (e.g. `Fullerton, CA`).
2. Pick a restaurant type and the menu items you plan to serve.
3. Pick a strategy:
 - **Gap Finder** — reward areas with few competitors
 - **Join Hotspot** — reward areas with dense competition (validated demand)
 - **Show Both** — report both sub-scores
4. Hit **Find Best Locations**. The map flies to the city and drops five numbered pins ranked green (best) → red.
5. Click a pin or a sidebar card to focus it. Save any candidate with and revisit it in the ** Saved** tab.

---

## ArcGIS APIs used

| API | Why |
| --- | --- |
| **World Geocoding** | Resolve a city name → center + bounding box that we grid across |
| **Places (near-point)** | Find competitors (e.g. "burger") and anchors (universities, malls) within 10 km |
| **GeoEnrichment** | Pull population + median household income around each candidate in a 1-mile ring |
| **Basemap: dark-gray-vector** | Clean dark canvas for a data-dense overlay |

---

## Architecture

```
 ┌──────────────────┐ REST / JSON ┌──────────────────┐
 │ React + Vite │ ─────────────────────▶│ Express API │
 │ @arcgis/core │ │ /api/analyze │
 │ Tailwind v4 │ ◀─────────────────────│ /api/saved-… │
 └──────────────────┘ └─────────┬────────┘
 │
 ┌────────────────────────────────┼──────────────────────────┐
 ▼ ▼ ▼
 ┌────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐
 │ ArcGIS services │ │ Scoring engine │ │ MongoDB │
 │ · Geocoding │ │ · grid generator │ │ · Search │
 │ · Places │ │ · haversine │ │ · SavedLocation │
 │ · GeoEnrichment │ │ · normalize + score │ │ │
 └────────────────────┘ └──────────────────────┘ └──────────────────┘
```

Pipeline: `geocode → places (parallel: competitors + anchors) → 4×5 grid → enrich → score → persist → respond`.

---

## Demo script (for judges)

- **"Find a gap."** Search `Fullerton, CA`, Fast Food, Gap Finder — rank 1 drops in an under-served block near CSUF.
- **"Join the hotspot."** Flip to Join Hotspot — the pins shuffle toward established food corridors, showing the strategy actually changes the output.
- **"Save it, come back."** Save the top result, switch to the Saved tab, and delete it — round-trips through MongoDB in one click.

---

## Scripts

**server**
- `npm run dev` — nodemon
- `npm start` — node

**client**
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview build
