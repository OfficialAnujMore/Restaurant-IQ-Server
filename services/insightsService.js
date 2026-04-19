import InsightCache from '../models/InsightCache.js';
import { getProvider } from './llmProviders.js';
import { buildPrompt, PROMPT_VERSION } from './prompts.js';

const REQUIRED_FIELDS = [
  'summary', 'highlights', 'best_for', 'pros', 'cons',
  'best_time_to_visit', 'things_to_verify', 'confidence_note',
];

function stripFences(raw) {
  return raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function parseLLMResponse(raw, location, context) {
  try {
    const parsed = JSON.parse(stripFences(raw));

    const missing = REQUIRED_FIELDS.filter((f) => parsed[f] == null);
    if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);

    // Some models return comma-joined strings instead of arrays
    for (const f of ['highlights', 'best_for', 'pros', 'cons', 'things_to_verify']) {
      if (typeof parsed[f] === 'string') {
        parsed[f] = parsed[f].split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(parsed[f])) parsed[f] = [];
    }

    return { data: parsed, parseError: null };
  } catch (err) {
    console.error('[insightsService] parse failed:', err.message, '| raw:', raw?.slice(0, 300));

    // Score-derived fallback — no LLM hallucinations
    const s = location.scores || {};
    return {
      data: {
        summary: `Site #${location.rank} scored ${location.totalScore}/100 in ${context.city} for ${context.category}.`,
        highlights: [
          `Total score: ${location.totalScore}/100`,
          `Population (1-mile): ${location.population?.toLocaleString() ?? 'N/A'}`,
          `Competitors nearby: ${location.competitorCount ?? 'N/A'}`,
        ],
        best_for: ['Unable to generate — please retry'],
        pros: [
          s.populationScore >= 14 ? 'Strong population density' : null,
          s.competitorScore >= 14 ? 'Low competition in area' : null,
          s.incomeScore >= 14 ? 'Favorable income demographics' : null,
        ].filter(Boolean),
        cons: [
          s.populationScore < 10 ? 'Below-average population density' : null,
          s.competitorScore < 10 ? 'High competitor presence' : null,
        ].filter(Boolean),
        best_time_to_visit: 'Could not determine — AI response was malformed',
        things_to_verify: [
          'Verify foot traffic patterns on-site',
          'Confirm competitor count with local research',
          'Check lease availability in the area',
        ],
        confidence_note:
          'AI analysis failed to parse. Fallback shown from raw scores. Try regenerating.',
      },
      parseError: err.message,
    };
  }
}

export async function generateInsights(
  location,
  context,
  { provider = 'openai', forceRegenerate = false } = {}
) {
  const cacheKey = {
    locationId: location.id,
    provider,
    city: context.city,
    category: context.category,
  };

  if (!forceRegenerate) {
    const cached = await InsightCache.findOne(cacheKey).lean();
    if (cached) {
      if (cached.promptVersion === PROMPT_VERSION) {
        return { insights: cached.insights, cached: true, parseError: null, provider };
      }
      // Prompt version bumped — fall through to regenerate
    }
  }

  const prompt = buildPrompt(location, context);
  const generateFn = getProvider(provider);
  const raw = await generateFn(prompt);
  const { data: insights, parseError } = parseLLMResponse(raw, location, context);

  try {
    await InsightCache.findOneAndUpdate(
      cacheKey,
      { $set: { insights, promptVersion: PROMPT_VERSION, createdAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (e) {
    // Duplicate key on concurrent request — safe to ignore, result is still valid
    if (e.code !== 11000) console.error('[insightsService] cache write error:', e.message);
  }

  return { insights, cached: false, parseError, provider };
}
