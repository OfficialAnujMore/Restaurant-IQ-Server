export function generateGrid(cityData, n = 20) {
  const cols = 4;
  const rows = 5;
  const padX = (cityData.xmax - cityData.xmin) * 0.1;
  const padY = (cityData.ymax - cityData.ymin) * 0.1;
  const xmin = cityData.xmin + padX;
  const xmax = cityData.xmax - padX;
  const ymin = cityData.ymin + padY;
  const ymax = cityData.ymax - padY;

  const points = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lng = xmin + ((xmax - xmin) * c) / (cols - 1);
      const lat = ymin + ((ymax - ymin) * r) / (rows - 1);
      points.push({ id: id++, lat, lng });
    }
  }
  return points.slice(0, n);
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalize(values) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

function anchorScoreFromDistance(d) {
  if (d <= 0.5) return 20;
  if (d <= 1.0) return 15;
  if (d <= 2.0) return 10;
  if (d <= 3.0) return 5;
  return 0;
}

export function scoreCandidates(candidates, enrichmentData, competitors, anchors, strategy) {
  const populations = enrichmentData.map((e) => e.population || 0);
  const incomes = enrichmentData.map((e) => e.income || 0);
  const normPop = normalize(populations);
  const normInc = normalize(incomes);

  const scored = candidates.map((cand, i) => {
    const populationScore = normPop[i] * 20;
    const incomeScore = normInc[i] * 20;

    let nearestAnchor = null;
    let nearestAnchorDist = Infinity;
    for (const a of anchors) {
      const d = haversineDistance(cand.lat, cand.lng, a.lat, a.lng);
      if (d < nearestAnchorDist) {
        nearestAnchorDist = d;
        nearestAnchor = a;
      }
    }
    const anchorScore = anchors.length ? anchorScoreFromDistance(nearestAnchorDist) : 0;

    let competitorCount = 0;
    for (const c of competitors) {
      if (haversineDistance(cand.lat, cand.lng, c.lat, c.lng) <= 1.0) competitorCount++;
    }

    const gapScore = Math.max(0, 20 - competitorCount * 4);
    const clusterScore = Math.min(competitorCount * 5, 20);
    let competitorScore;
    if (strategy === 'cluster') competitorScore = clusterScore;
    else if (strategy === 'both') competitorScore = gapScore;
    else competitorScore = gapScore;

    const footScore = (normPop[i] * 0.6 + (anchorScore / 20) * 0.4) * 20;
    const catchmentScore = normPop[i] * 20;

    const totalScore =
      populationScore +
      incomeScore +
      anchorScore +
      competitorScore +
      footScore +
      catchmentScore;

    return {
      ...cand,
      population: populations[i],
      medianIncome: incomes[i],
      competitorCount,
      nearestAnchor: nearestAnchor ? nearestAnchor.name : null,
      nearestAnchorType: nearestAnchor ? nearestAnchor.type : null,
      nearestAnchorDistance: isFinite(nearestAnchorDist) ? nearestAnchorDist : null,
      scores: {
        populationScore,
        incomeScore,
        anchorScore,
        competitorScore,
        footScore,
        catchmentScore,
        ...(strategy === 'both' ? { gapScore, clusterScore } : {}),
      },
      totalScore,
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  scored.slice(0, 5).forEach((s, i) => {
    s.rank = i + 1;
  });
  return scored;
}
