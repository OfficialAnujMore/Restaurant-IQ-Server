export const PROMPT_VERSION = process.env.INSIGHTS_PROMPT_VERSION || 'v1';

const VERSIONS = { v1: buildPromptV1 };

export function buildPrompt(location, context, version = PROMPT_VERSION) {
  const builder = VERSIONS[version];
  if (!builder) throw new Error(`Unknown prompt version: "${version}"`);
  return builder(location, context);
}

function buildPromptV1(location, context) {
  const {
    rank, lat, lng, population, medianIncome, competitorCount,
    nearestAnchor, nearestAnchorType, nearestAnchorDistance,
    totalScore, scores = {},
  } = location;
  const { city, category } = context;

  const incomeFormatted = medianIncome
    ? `$${medianIncome.toLocaleString('en-US')}`
    : 'unknown';

  const anchorLine = nearestAnchor && nearestAnchorDistance != null
    ? `The nearest anchor is "${nearestAnchor}" (${nearestAnchorType}), ${nearestAnchorDistance.toFixed(2)} miles away.`
    : 'No nearby anchor (mall or university) was identified within the search radius.';

  return `You are analyzing a candidate restaurant site for a ${category} restaurant in ${city}.

This location ranked #${rank} out of 5 top candidates. Here is the complete data:

SCORE BREAKDOWN:
- Population Score: ${scores.populationScore ?? 'N/A'}/20 — ${population?.toLocaleString() ?? 'N/A'} residents within 1-mile radius
- Income Score: ${scores.incomeScore ?? 'N/A'}/20 — median household income: ${incomeFormatted}
- Anchor Score: ${scores.anchorScore ?? 'N/A'}/20 — proximity to major foot-traffic generators
- Competitor Score: ${scores.competitorScore ?? 'N/A'}/20 — ${competitorCount ?? 'N/A'} competing ${category} restaurants found (higher score = less competition)
- Foot Traffic Score: ${scores.footScore ?? 'N/A'}/20
- Catchment Score: ${scores.catchmentScore ?? 'N/A'}/20 — geographic service area quality
Total Composite Score: ${totalScore}/100

${anchorLine}

Coordinates: ${lat?.toFixed(4)}, ${lng?.toFixed(4)} — do NOT infer street names, neighborhoods, or nearby businesses from coordinates.

STRICT RULES:
1. Base analysis ONLY on the numbers above — no invented addresses, cross streets, or business names.
2. If competitorCount is 0, note it could mean low demand OR low competition — do not assume one.
3. Express genuine uncertainty in confidence_note when data is limited.
4. Tone: helpful, neutral, concise — not marketing copy.

Respond with ONLY this JSON, no markdown fences, no extra text:
{
  "summary": "2-3 sentence overall site assessment for a ${category} restaurant",
  "highlights": ["3-4 key data points driving this score"],
  "best_for": ["2-3 restaurant formats/concepts that would suit these demographics"],
  "pros": ["3-5 genuine advantages from the data"],
  "cons": ["2-4 genuine concerns from the data"],
  "best_time_to_visit": "When foot traffic is likely highest based on anchor type and demographics",
  "things_to_verify": ["3-5 things a site visit or broker should confirm that the data cannot"],
  "confidence_note": "Brief note on data quality or analytical limitations"
}`;
}
