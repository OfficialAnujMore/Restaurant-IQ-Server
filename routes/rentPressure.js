import express from 'express';
import { computeRentPressure } from '../services/rentPressure.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { lat, lng } = req.body || {};

  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  try {
    const pressureData = await computeRentPressure(latNum, lngNum);
    res.json({
      pressureData,
      centerLat: latNum,
      centerLng: lngNum,
      pointCount: pressureData.length,
    });
  } catch (err) {
    console.error('[rent-pressure] failed:', err.message);
    res.status(500).json({ error: 'Rent pressure analysis failed', message: err.message });
  }
});

export default router;
