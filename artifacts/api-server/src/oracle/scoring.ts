import type { PortfolioObservation, ScoredWarrior, WarriorLevel } from "./types";

function boundedPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreObservation(observation: PortfolioObservation): ScoredWarrior {
  const {
    currentValueUsd,
    startingValueUsd,
    highWaterMarkUsd,
    lowWaterMarkUsd,
    maxDrawdownPct,
    recoveredFromDrawdown,
    observedAt,
  } = observation;

  for (const value of [currentValueUsd, highWaterMarkUsd, lowWaterMarkUsd, maxDrawdownPct]) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Portfolio observation contains invalid numeric data");
  }
  if (startingValueUsd < 0 || !Number.isFinite(startingValueUsd)) {
    throw new Error("Portfolio observation contains an invalid starting value");
  }

  const roiPct = startingValueUsd > 0
    ? boundedPercent(((currentValueUsd - startingValueUsd) / startingValueUsd) * 100)
    : null;
  const drawdownPct = highWaterMarkUsd > 0
    ? boundedPercent(((highWaterMarkUsd - currentValueUsd) / highWaterMarkUsd) * 100)
    : null;

  let level: WarriorLevel = "Newb";
  if (startingValueUsd > 0 && currentValueUsd <= highWaterMarkUsd * 0.25) level = "Liquidated";
  else if (startingValueUsd > 0 && recoveredFromDrawdown && roiPct !== null && roiPct >= 50) level = "Plumber";
  else if (startingValueUsd > 0 && roiPct !== null && roiPct >= 25 && (drawdownPct ?? 100) <= 15) level = "Elite";
  else if (startingValueUsd > 0 && roiPct !== null && roiPct > 0) level = "Profitable";
  else if ((drawdownPct ?? 0) > 35) level = "Wrecked";
  else if (startingValueUsd > 0 && (roiPct ?? 0) > -25) level = "Back";
  else if (startingValueUsd > 0) level = "Hardened";

  return {
    level,
    roiPct,
    drawdownPct,
    currentValueUsd: boundedPercent(currentValueUsd),
    highWaterMarkUsd: boundedPercent(highWaterMarkUsd),
    lowWaterMarkUsd: boundedPercent(lowWaterMarkUsd),
    recoveredFromDrawdown,
    observedAt,
  };
}