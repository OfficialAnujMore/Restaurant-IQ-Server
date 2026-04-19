import axios from 'axios';

const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';
const ACS_URL = 'https://api.census.gov/data/2022/acs/acs5';
const CONCURRENCY = 10;

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); }
      catch (err) { results[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function tractForPoint(lat, lng) {
  const { data, status } = await axios.get(CENSUS_GEOCODER_URL, {
    params: { x: lng, y: lat, benchmark: 'Public_AR_Current', vintage: 'Current_Current', layers: 'Census Tracts', format: 'json' },
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300) return null;
  const tracts = data?.result?.geographies?.['Census Tracts'];
  const t = Array.isArray(tracts) ? tracts[0] : null;
  if (!t) return null;
  return { state: t.STATE, county: t.COUNTY, tract: t.TRACT, geoid: t.GEOID };
}

async function fetchAcsForCounty(state, county) {
  const { data, status } = await axios.get(ACS_URL, {
    params: { get: 'B01003_001E,B19013_001E', for: 'tract:*', in: `state:${state} county:${county}` },
    timeout: 15_000,
    validateStatus: () => true,
  });
  if (status < 200 || status >= 300 || !Array.isArray(data) || data.length < 2) return new Map();
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
    const pop = Number(row[popIdx]);
    const inc = Number(row[incIdx]);
    map.set(geoid, {
      population: Number.isFinite(pop) && pop >= 0 ? pop : 0,
      income: Number.isFinite(inc) && inc >= 0 ? inc : 0,
    });
  }
  return map;
}

// Drop-in replacement for geoenrichBatch — returns [{population, income}] per point
export async function geoenrichBatch(points) {
  const zeros = () => points.map(() => ({ population: 0, income: 0 }));
  if (!points?.length) return [];

  try {
    const tracts = await runWithConcurrency(points, CONCURRENCY, (p) =>
      tractForPoint(p.lat, p.lng)
    );

    const countyKeys = new Set();
    for (const t of tracts) {
      if (t?.state && t?.county) countyKeys.add(`${t.state}:${t.county}`);
    }

    const acsByCounty = new Map();
    await Promise.all(
      Array.from(countyKeys).map(async (key) => {
        const [state, county] = key.split(':');
        try {
          acsByCounty.set(key, await fetchAcsForCounty(state, county));
        } catch {
          acsByCounty.set(key, new Map());
        }
      })
    );

    return points.map((_, i) => {
      const t = tracts[i];
      if (!t) return { population: 0, income: 0 };
      const tractMap = acsByCounty.get(`${t.state}:${t.county}`) || new Map();
      return tractMap.get(t.geoid) ?? { population: 0, income: 0 };
    });
  } catch (err) {
    console.error('[censusEnrich] failed:', err.message);
    return zeros();
  }
}
