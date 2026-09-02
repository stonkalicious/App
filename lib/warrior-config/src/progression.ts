import type { WarriorStageKey } from "./index";

export type DollarPnlPlayer = {
  id: string;
  dollarPnlUsd: number;
};

export type RankedDollarPnlPlayer = DollarPnlPlayer & {
  rank: number;
  stage: WarriorStageKey;
};

export type ProgressionBand = {
  stage: WarriorStageKey;
  share: number;
};

// Ordered from the highest dollar P&L tier to the lowest. The shares are
// applied to the current comparison cohort, so levels can move in either
// direction as P&L and the cohort change.
export const WARRIOR_PROGRESSION_BANDS: readonly ProgressionBand[] = [
  { stage: "plumber", share: 0.005 },
  { stage: "elite", share: 0.015 },
  { stage: "profitable", share: 0.03 },
  { stage: "hardened", share: 0.05 },
  { stage: "wrecked", share: 0.08 },
  { stage: "back", share: 0.12 },
  { stage: "liquidated", share: 0.20 },
  { stage: "newb", share: 0.50 },
] as const;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertDollarPnl(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error("Dollar P&L must be finite");
  }
}

export function stageForDollarPnlRank(rank: number, cohortSize: number): WarriorStageKey {
  assertPositiveInteger(rank, "rank");
  assertPositiveInteger(cohortSize, "cohortSize");
  if (rank > cohortSize) throw new Error("rank cannot exceed cohortSize");

  let cumulativeShare = 0;
  for (const band of WARRIOR_PROGRESSION_BANDS) {
    cumulativeShare += band.share;
    const boundary = Math.round(cumulativeShare * cohortSize);
    if (rank <= boundary) return band.stage;
  }

  return "newb";
}

export function rankDollarPnl(players: readonly DollarPnlPlayer[], cohortSize = players.length): RankedDollarPnlPlayer[] {
  assertPositiveInteger(cohortSize, "cohortSize");
  if (players.length === 0) return [];
  if (players.length > cohortSize) throw new Error("players cannot exceed cohortSize");

  const seen = new Set<string>();
  for (const player of players) {
    if (!player.id || seen.has(player.id)) throw new Error("Dollar P&L player IDs must be unique");
    seen.add(player.id);
    assertDollarPnl(player.dollarPnlUsd);
  }

  return [...players]
    .sort((a, b) => b.dollarPnlUsd - a.dollarPnlUsd || a.id.localeCompare(b.id))
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      stage: stageForDollarPnlRank(index + 1, cohortSize),
    }));
}