import express from 'express';
import mongoose from 'mongoose';
import SavedLocation from '../models/SavedLocation.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const items = await SavedLocation.find({ userId: req.userId }).sort({ savedAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = await SavedLocation.create({ ...req.body, userId: req.userId });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await SavedLocation.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
