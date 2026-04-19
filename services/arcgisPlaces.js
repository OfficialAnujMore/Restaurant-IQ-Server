import axios from 'axios';

const PLACES_URL =
  'https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point';

export async function searchPlaces(keyword, lat, lng, radiusMeters, maxResults = 20) {
  try {
    const response = await axios.get(PLACES_URL, {
      params: {
        x: lng,
        y: lat,
        radius: Math.min(radiusMeters, 10000),
        searchText: keyword,
        pageSize: maxResults,
        f: 'json',
        token: process.env.ARCGIS_API_KEY,
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      console.warn(`Places API ${response.status} for "${keyword}"`);
      return [];
    }

    const results = response.data?.results || [];
    return results.map((r) => ({
      name: r.name,
      lat: r.location.y,
      lng: r.location.x,
    }));
  } catch (err) {
    console.warn(`Places API error for "${keyword}":`, err.message);
    return [];
  }
}

export async function findCompetitors(searchKeyword, lat, lng) {
  return searchPlaces(searchKeyword, lat, lng, 10000, 20);
}

export async function findAnchors(lat, lng) {
  const [universities, malls] = await Promise.all([
    searchPlaces('university', lat, lng, 10000, 20),
    searchPlaces('shopping mall', lat, lng, 10000, 20),
  ]);
  return [
    ...universities.map((u) => ({ ...u, type: 'university' })),
    ...malls.map((m) => ({ ...m, type: 'mall' })),
  ];
}
