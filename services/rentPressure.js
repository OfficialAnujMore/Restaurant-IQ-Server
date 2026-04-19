import axios from 'axios';
import { haversineDistance, normalize } from './scoringEngine.js';

const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';
const ACS_URL = 'https://api.census.gov/data/2022/acs/acs5';

const RADIUS_MILES = 1.5;
const SPACING_MILES = 0.25;
const GEOCODE_CONCURRENCY = 12;

function generateFineGrid(centerLat, centerLng) {
  const dLat = SPACING_MILES / 69;
  const dLng = SPACING_MILES / (69 * Math.cos((centerLat * Math.PI) / 180));
  const latSteps = Math.ceil(RADIUS_MILES / SPACING_MILES);
  const lngSteps = Math.ceil(RADIUS_MILES / SPACING_MILES);

  const points = [];
  for (let i = -latSteps; i <= latSteps; i++) {
    for (let j = -lngSteps; j <= lngSteps; j++) {
      const lat = centerLat + i * dLat;
      const lng = centerLng + j * dLng;
      if (haversineDistance(centerLat, centerLng, lat, lng) <= RADIUS_MILES) {
        points.push({ lat, lng });
      }
    }
  }
  return points;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { __error: err.message };
      }
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

async function tractForPoint(lat, lng) {
  const { data, status } = await axios.get(CENSUS_GEOCODER_URL, {
    params: {
      x: lng,
      y: lat,
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      layers: 'Census Tracts',
      format: 'json',
    },
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300) return null;
  const tracts = data?.result?.geographies?.['Census Tracts'];
  const t = Array.isArray(tracts) ? tracts[0] : null;
  if (!t) return null;
  return {
    state: t.STATE,
    county: t.COUNTY,
    tract: t.TRACT,
    geoid: t.GEOID,
  };
}

async function fetchAcsForCounty(state, county) {
  const { data, status } = await axios.get(ACS_URL, {
    params: {
      get: 'B01003_001E,B19013_001E',
      for: 'tract:*',
      in: `state:${state} county:${county}`,
    },
    timeout: 15_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300 || !Array.isArray(data) || data.length < 2) {
    return new Map();
  }
  const headers = data[0];
  const popIdx = headers.indexOf('B01003_001E');
  const incIdx = headers.indexOf('B19013_001E');
  const stateIdx = headers.indexOf('state');
  const countyIdx = headers.indexOf('county');
  const tractIdx = headers.indexOf('tract');
  const map = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const geoid = `${row[stateIdx]}${row[countyIdx]}${row[tractIdx]}`;
    const totalPop = Number(row[popIdx]);
    const rawIncome = Number(row[incIdx]);
    map.set(geoid, {
      totalPop: Number.isFinite(totalPop) && totalPop >= 0 ? totalPop : 0,
      income: Number.isFinite(rawIncome) && rawIncome >= 0 ? rawIncome : 0,
    });
  }
  return map;
}

export async function computeRentPressure(centerLat, centerLng) {
  const grid = generateFineGrid(centerLat, centerLng);

  const tracts = await runWithConcurrency(grid, GEOCODE_CONCURRENCY, (p) =>
    tractForPoint(p.lat, p.lng)
  );

  const countyKeys = new Set();
  for (const t of tracts) {
    if (t && !t.__error && t.state && t.county) {
      countyKeys.add(`${t.state}:${t.county}`);
    }
  }

  const acsByCounty = new Map();
  await Promise.all(
    Array.from(countyKeys).map(async (key) => {
      const [state, county] = key.split(':');
      try {
        const tractMap = await fetchAcsForCounty(state, county);
        acsByCounty.set(key, tractMap);
      } catch (err) {
        console.warn(`[rentPressure] ACS fetch failed for ${key}: ${err.message}`);
        acsByCounty.set(key, new Map());
      }
    })
  );

  const enriched = grid.map((p, i) => {
    const t = tracts[i];
    if (!t || t.__error) return { income: 0, totalPop: 0 };
    const tractMap = acsByCounty.get(`${t.state}:${t.county}`) || new Map();
    const v = tractMap.get(t.geoid);
    return v ? { income: v.income, totalPop: v.totalPop } : { income: 0, totalPop: 0 };
  });

  const incomeNorm = normalize(enriched.map((e) => e.income));
  const totalPopNorm = normalize(enriched.map((e) => e.totalPop));

  const result = grid.map((p, i) => {
    const pressureIndex =
      Math.round((incomeNorm[i] * 0.7 + totalPopNorm[i] * 0.3) * 1000) / 1000;
    return {
      lat: p.lat,
      lng: p.lng,
      pressureIndex,
      pressureScore: Math.round(pressureIndex * 100),
      raw: {
        income: enriched[i].income,
        daytimePop: 0,
        totalPop: enriched[i].totalPop,
      },
    };
  });

  result.sort((a, b) => b.pressureIndex - a.pressureIndex);
  return result;
}
