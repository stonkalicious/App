import { WARRIOR_LEVEL_LABELS, type PortfolioObservation, type ScoredWarrior, type WarriorStageKey } from "./types";

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

  let stage: WarriorStageKey = "newb";
  if (startingValueUsd > 0 && currentValueUsd <= highWaterMarkUsd * 0.25) stage = "liquidated";
  else if (startingValueUsd > 0 && recoveredFromDrawdown && roiPct !== null && roiPct >= 50) stage = "plumber";
  else if (startingValueUsd > 0 && roiPct !== null && roiPct >= 25 && (drawdownPct ?? 100) <= 15) stage = "elite";
  else if (startingValueUsd > 0 && roiPct !== null && roiPct > 0) stage = "profitable";
  else if ((drawdownPct ?? 0) > 35) stage = "wrecked";
  else if (startingValueUsd > 0 && (roiPct ?? 0) > -25) stage = "back";
  else if (startingValueUsd > 0) stage = "hardened";

  return {
    stage,
    level: WARRIOR_LEVEL_LABELS[stage],
    roiPct,
    drawdownPct,
    currentValueUsd: boundedPercent(currentValueUsd),
    highWaterMarkUsd: boundedPercent(highWaterMarkUsd),
    lowWaterMarkUsd: boundedPercent(lowWaterMarkUsd),
    recoveredFromDrawdown,
    observedAt,
  };
}