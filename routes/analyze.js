import express from 'express';
import mongoose from 'mongoose';
import Search from '../models/Search.js';
import { geocodeCity } from '../services/arcgisGeocoding.js';
import { findCompetitors, findAnchors } from '../services/arcgisPlaces.js';
import { geoenrichBatch } from '../services/arcgisGeoEnrichment.js';
import { generateGrid, scoreCandidates } from '../services/scoringEngine.js';

const router = express.Router();

const CATEGORY_KEYWORDS = {
  'Fast Food': 'burger',
  'Pizza & Italian': 'pizza',
  Asian: 'sushi',
  Mexican: 'tacos',
  'Cafe & Coffee': 'coffee',
  Healthy: 'salad',
};

function keywordFor(category) {
  return CATEGORY_KEYWORDS[category] || String(category).toLowerCase();
}

router.post('/', async (req, res) => {
  const { city, category, menuItems, strategy = 'gap' } = req.body || {};

  if (!city || !category) {
    return res.status(400).json({ error: 'city and category are required' });
  }

  let step = 'init';
  try {
    step = 'geocode';
    const cityData = await geocodeCity(city);

    step = 'places';
    const searchKeyword = keywordFor(category);
    const [competitors, anchors] = await Promise.all([
      findCompetitors(searchKeyword, cityData.lat, cityData.lng),
      findAnchors(cityData.lat, cityData.lng),
    ]);

    step = 'grid';
    const candidates = generateGrid(cityData, 20);

    step = 'enrich';
    const enrichmentData = await geoenrichBatch(candidates);

    step = 'score';
    const scoredResults = scoreCandidates(
      candidates,
      enrichmentData,
      competitors,
      anchors,
      strategy
    );

    step = 'persist';
    if (mongoose.connection.readyState === 1) {
      await Search.create({
        city,
        category,
        menuItems,
        strategy,
        results: scoredResults,
        userId: req.userId,
      });
    }

    res.json({
      city,
      category,
      strategy,
      cityCenter: { lat: cityData.lat, lng: cityData.lng },
      top5: scoredResults.slice(0, 5),
      competitors,
      anchors,
      allCandidates: scoredResults,
    });
  } catch (err) {
    console.error(`[analyze] step=${step} failed:`, err.message);
    res.status(500).json({ error: true, step, message: err.message });
  }
});

export default router;
