import { Router } from 'express';
import { generateInsights } from '../services/insightsService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { location, context, provider = 'openai', forceRegenerate = false } = req.body;

  if (!location || typeof location !== 'object')
    return res.status(400).json({ error: 'location object is required' });
  if (!context?.city || !context?.category)
    return res.status(400).json({ error: 'context.city and context.category are required' });
  if (provider !== 'openai')
    return res.status(400).json({ error: 'provider must be "openai"' });
  if (location.id == null)
    return res.status(400).json({ error: 'location.id is required' });

  try {
    const result = await generateInsights(location, context, {
      provider,
      forceRegenerate: Boolean(forceRegenerate),
    });
    return res.json(result);
  } catch (err) {
    console.error('[POST /api/insights]', err.message);

    if (err.message.includes('is not set')) {
      return res.status(503).json({
        error: 'AI provider not configured. Contact administrator.',
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }
    if (err.message.includes('API error')) {
      return res.status(502).json({
        error: 'AI provider error. Please try again.',
        code: 'PROVIDER_ERROR',
      });
    }
    return res.status(500).json({ error: 'Failed to generate insights', code: 'INTERNAL_ERROR' });
  }
});

export default router;
