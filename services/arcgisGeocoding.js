import axios from 'axios';

const GEOCODE_URL =
  'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

async function findCandidates(query, extraParams = {}) {
  const { data } = await axios.get(GEOCODE_URL, {
    params: {
      SingleLine: query,
      outFields: 'City,Region,Country',
      maxLocations: 1,
      forStorage: 'false',
      f: 'json',
      token: process.env.ARCGIS_API_KEY,
      ...extraParams,
    },
  });
  return data?.candidates || [];
}

export async function geocodeCity(city) {
  const query = String(city).trim();

  let candidates = await findCandidates(query, { category: 'City,Populated Place' });

  if (candidates.length === 0 && !/,/.test(query)) {
    candidates = await findCandidates(`${query}, USA`, { category: 'City,Populated Place' });
  }

  if (candidates.length === 0) {
    candidates = await findCandidates(query);
  }

  if (candidates.length === 0) {
    throw new Error('City not found: ' + city);
  }

  const c = candidates[0];
  if (!c.extent) {
    const lng = c.location.x;
    const lat = c.location.y;
    const d = 0.1;
    c.extent = { xmin: lng - d, ymin: lat - d, xmax: lng + d, ymax: lat + d };
  }

  return {
    lat: c.location.y,
    lng: c.location.x,
    xmin: c.extent.xmin,
    ymin: c.extent.ymin,
    xmax: c.extent.xmax,
    ymax: c.extent.ymax,
    label: c.address,
  };
}
