# RestaurantIQ — Server

Express API backend for RestaurantIQ, an ArcGIS-powered location intelligence tool for restaurant site selection.

**Repos:** [Client](https://github.com/OfficialAnujMore/Restaurant-IQ-Client)
## Demo

[![RestaurantIQ Demo](https://img.youtube.com/vi/VoYTlok4mdE/maxresdefault.jpg)](https://youtu.be/VoYTlok4mdE?si=1gPWw3Siexrv3Wkb)

![RestaurantIQ Landing Screen](assets/Landing.jpg)

![RestaurantIQ Dashboard Screen](assets/Dashboard.png)

## Problem Statement

Finding the right location for a new restaurant is expensive and risky. RestaurantIQ's backend orchestrates a scoring pipeline: it geocodes a city, generates a candidate grid, fetches competitor and anchor data from ArcGIS Places, enriches each point with demographics via GeoEnrichment and Census APIs, scores locations using a configurable strategy, and serves the results to the frontend. A separate AI insights endpoint calls OpenAI GPT-4o-mini to produce human-readable analysis per location.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Runtime |
| **Express** | 5 | HTTP framework |
| **MongoDB + Mongoose** | 9 | Persist saved locations, search history, insight cache |
| **JWT + bcryptjs** | — | User authentication and password hashing |
| **cookie-parser** | — | JWT delivery via HTTP-only cookies |
| **OpenAI API** | gpt-4o-mini | AI-generated location insights |
| **ArcGIS REST APIs** | — | Geocoding, Places (competitors + anchors), GeoEnrichment |
| **U.S. Census API** | — | Supplemental demographic enrichment |
| **dotenv** | — | Environment variable management |
| **nodemon** | — | Dev server with hot reload |

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT cookie |
| `POST` | `/api/auth/logout` | Clear auth cookie |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/analyze` | Run full location scoring pipeline |
| `GET` | `/api/saved-locations` | List saved candidate locations |
| `POST` | `/api/saved-locations` | Save a candidate location |
| `DELETE` | `/api/saved-locations/:id` | Delete a saved location |
| `POST` | `/api/insights` | Generate AI insights for a location |
| `POST` | `/api/rent-pressure` | Compute rent pressure score for a coordinate |

## Scoring Pipeline

```
geocode → places (parallel: competitors + anchors) → 4×5 grid → enrich → score → persist → respond
```

Strategy options passed in the request body:
- **Gap Finder** — rewards locations with fewer nearby competitors
- **Join Hotspot** — rewards locations with dense established competition (validated demand)
- **Show Both** — returns both sub-scores

## Setup

```bash
npm install
```

Create `.env`:

```
ARCGIS_API_KEY=your_arcgis_api_key_here
MONGO_URI=your_mongodb_connection_string_here
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_jwt_secret_here
PORT=5000
```

```bash
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start with node |

## Models

- **User** — name, email, hashed password
- **SavedLocation** — scored candidate with lat/lng, scores, and metadata
- **Search** — search history per user
- **InsightCache** — cached AI insights keyed by location + context to avoid redundant LLM calls
