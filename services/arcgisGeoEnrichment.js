import axios from 'axios';

const ENRICH_URL =
  'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich';

function extractFeatures(data) {
  // Standard path: data.results[0].value.FeatureSet[0].features
  const r0 = data?.results?.[0]?.value;
  if (r0?.FeatureSet?.[0]?.features) return r0.FeatureSet[0].features;
  if (r0?.features) return r0.features;
  // Alternate: data.FeatureSet[0].features
  if (data?.FeatureSet?.[0]?.features) return data.FeatureSet[0].features;
  return null;
}

export async function geoenrichBatch(points) {
  const zeros = () => points.map(() => ({ population: 0, income: 0 }));

  if (!points?.length) return [];

  try {
    const body = new URLSearchParams();
    body.append(
      'studyAreas',
      JSON.stringify(points.map((p) => ({ geometry: { x: p.lng, y: p.lat } })))
    );
    body.append(
      'analysisVariables',
      JSON.stringify(['KeyUSFacts.TOTPOP_CY', 'KeyUSFacts.MEDHINC_CY'])
    );
    body.append(
      'studyAreasOptions',
      JSON.stringify({ areaType: 'RingBuffer', bufferUnits: 'Miles', bufferRadii: [1] })
    );
    body.append('returnGeometry', 'false');
    body.append('f', 'json');
    body.append('token', process.env.ARCGIS_API_KEY);

    const result = await axios.post(ENRICH_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    });

    if (result.status < 200 || result.status >= 300) {
      console.error(`GeoEnrichment HTTP ${result.status}:`, JSON.stringify(result.data).slice(0, 400));
      return zeros();
    }

    if (result.data?.error) {
      const { code, message } = result.data.error;
      console.error(`GeoEnrichment API error: ${code} ${message}`);
      if (code === 498 || code === 499) {
        console.error('→ Fix: enable the GeoEnrichment privilege on your ArcGIS API key at developers.arcgis.com');
      }
      return zeros();
    }
    if (result.data?.messages?.length) {
      console.warn('GeoEnrichment messages:', result.data.messages.slice(0, 3));
    }

    const features = extractFeatures(result.data);
    if (!features) {
      console.error(
        'GeoEnrichment unexpected response shape. Top-level keys:',
        Object.keys(result.data || {}),
        '— sample:',
        JSON.stringify(result.data).slice(0, 400)
      );
      return zeros();
    }

    const mapped = features.map((f) => {
      const a = f.attributes || {};
      return {
        population: Number(a.TOTPOP_CY ?? a.totpop_cy ?? 0) || 0,
        income: Number(a.MEDHINC_CY ?? a.medhinc_cy ?? 0) || 0,
      };
    });

    // Ensure we return one row per input point; pad/trim if needed.
    if (mapped.length < points.length) {
      while (mapped.length < points.length) mapped.push({ population: 0, income: 0 });
    } else if (mapped.length > points.length) {
      mapped.length = points.length;
    }
    return mapped;
  } catch (err) {
    console.error('GeoEnrichment parse/request failed:', err.message);
    return zeros();
  }
}
