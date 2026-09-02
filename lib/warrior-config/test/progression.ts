import assert from "node:assert/strict";
import { rankDollarPnl, stageForDollarPnlRank } from "../src/index";

const expectedBoundaries = [
  [1, "plumber"],
  [22, "plumber"],
  [23, "elite"],
  [89, "elite"],
  [90, "profitable"],
  [222, "profitable"],
  [223, "hardened"],
  [444, "hardened"],
  [445, "wrecked"],
  [800, "wrecked"],
  [801, "back"],
  [1333, "back"],
  [1334, "liquidated"],
  [2222, "liquidated"],
  [2223, "newb"],
  [4444, "newb"],
] as const;

for (const [rank, stage] of expectedBoundaries) {
  assert.equal(stageForDollarPnlRank(rank, 4444), stage, `rank ${rank} should be ${stage}`);
}

const tied = rankDollarPnl(
  [
    { id: "beta", dollarPnlUsd: 100 },
    { id: "alpha", dollarPnlUsd: 100 },
    { id: "gamma", dollarPnlUsd: 50 },
  ],
  100,
);
assert.deepEqual(tied.map((player) => player.id), ["alpha", "beta", "gamma"]);
assert.deepEqual(tied.map((player) => player.rank), [1, 2, 3]);

const rising = rankDollarPnl(
  [
    { id: "holder-a", dollarPnlUsd: 100 },
    { id: "holder-b", dollarPnlUsd: 50 },
  ],
  100,
);
const falling = rankDollarPnl(
  [
    { id: "holder-a", dollarPnlUsd: 100 },
    { id: "holder-b", dollarPnlUsd: 150 },
  ],
  100,
);
assert.equal(rising.find((player) => player.id === "holder-a")?.stage, "plumber");
assert.equal(rising.find((player) => player.id === "holder-b")?.stage, "elite");
assert.equal(falling.find((player) => player.id === "holder-b")?.stage, "plumber");
assert.equal(falling.find((player) => player.id === "holder-a")?.stage, "elite");

console.log("Progression passed: 4,444 boundaries, deterministic ties, and rising/falling ranks checked.");