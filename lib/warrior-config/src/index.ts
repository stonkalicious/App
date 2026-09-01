import artworkMap from "./artwork-map.json";

export const WARRIOR_STAGE_KEYS = [
  "newb",
  "liquidated",
  "back",
  "wrecked",
  "hardened",
  "profitable",
  "elite",
  "plumber",
] as const;

export type WarriorStageKey = (typeof WARRIOR_STAGE_KEYS)[number];

export type WarriorLevel =
  | "Beginning"
  | "Climbing"
  | "Contender"
  | "Stacked"
  | "Forged"
  | "Master"
  | "Elite"
  | "God";

export type WarriorArtworkStatus = "available" | "blocked";

export type WarriorArtwork = {
  level: WarriorLevel;
  filename: string;
  status: WarriorArtworkStatus;
  blocker?: string;
};

export const WARRIOR_ARTWORK_MAP = artworkMap as Record<WarriorStageKey, WarriorArtwork>;

export const WARRIOR_LEVEL_LABELS = WARRIOR_STAGE_KEYS.reduce(
  (labels, key) => {
    labels[key] = WARRIOR_ARTWORK_MAP[key].level;
    return labels;
  },
  {} as Record<WarriorStageKey, WarriorLevel>,
);