export type WarriorLevel =
  | "Newb"
  | "Liquidated"
  | "Back"
  | "Wrecked"
  | "Hardened"
  | "Profitable"
  | "Elite"
  | "Plumber";

export type AssetKind = "coin";

export type AllowlistedAsset = {
  symbol: string;
  contractAddress: string;
  kind: AssetKind;
  decimals: number;
  maxContributionUsd?: number;
};

export type PortfolioObservation = {
  wallet: string;
  currentValueUsd: number;
  startingValueUsd: number;
  highWaterMarkUsd: number;
  lowWaterMarkUsd: number;
  maxDrawdownPct: number;
  recoveredFromDrawdown: boolean;
  observedAt: string;
  assets: Array<{
    symbol: string;
    kind: AssetKind;
    valueUsd: number;
    included: boolean;
    exclusionReason?: string;
  }>;
};

export type ContractSnapshot = {
  tokenId: string;
  wallet: string;
  epoch: string;
  acquiredAt: string;
  startingBagValueUsd: number;
};

export type ScoredWarrior = {
  level: WarriorLevel;
  roiPct: number | null;
  drawdownPct: number | null;
  currentValueUsd: number;
  highWaterMarkUsd: number;
  lowWaterMarkUsd: number;
  recoveredFromDrawdown: boolean;
  observedAt: string;
};

export type MetadataResponse = {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  properties: {
    wallet: string;
    epoch: string;
    observedAt: string;
    stale: boolean;
  };
};