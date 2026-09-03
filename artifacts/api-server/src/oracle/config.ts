import type { AllowlistedAsset } from "./types";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export const DEFAULT_CRYPTO_SYMBOLS = [
  "VIRTUAL", "PONS", "CASHCAT", "STONKBROKER", "PIPEDOG", "INDEX", "DOGO",
  "CHUMP", "CHAI", "STATICS", "HMM", "LIAM", "GOONER", "CASHBIRD", "DELTA",
  "AI", "PONSTER", "MOO", "JOHN", "HOOKR", "QUOTRON", "TENDIES", "MICRODUCK",
  "GPRO", "GOOD", "RAM", "DTF", "RABBIT", "TWO",
] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the oracle service`);
  return value;
}

function parseAllowlistOverride(): AllowlistedAsset[] | undefined {
  const raw = process.env.ROBINHOOD_ASSET_ALLOWLIST_JSON?.trim();
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ROBINHOOD_ASSET_ALLOWLIST_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("ROBINHOOD_ASSET_ALLOWLIST_JSON must be a non-empty array");
  }
  return parsed.map((asset, index) => {
    if (!asset || typeof asset !== "object") throw new Error(`Allowlist entry ${index} is invalid`);
    const candidate = asset as Record<string, unknown>;
    const symbol = typeof candidate.symbol === "string" ? candidate.symbol.trim().toUpperCase() : "";
    const contractAddress = typeof candidate.contractAddress === "string" ? candidate.contractAddress : "";
    const kind = candidate.kind;
    const decimals = candidate.decimals;
    if (!symbol || !addressPattern.test(contractAddress) || !["coin", "stock", "crypto"].includes(kind as string)) {
      throw new Error(`Allowlist entry ${index} must contain symbol, EVM contractAddress, and a supported asset kind`);
    }
    if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new Error(`Allowlist entry ${index} has invalid decimals`);
    }
    const maxContributionUsd = candidate.maxContributionUsd;
    if (maxContributionUsd !== undefined && (typeof maxContributionUsd !== "number" || maxContributionUsd <= 0)) {
      throw new Error(`Allowlist entry ${index} has invalid maxContributionUsd`);
    }
    return { symbol, contractAddress, kind: kind as AllowlistedAsset["kind"], decimals, maxContributionUsd };
  });
}

export type OracleConfig = {
  metadataBaseUrl: string;
  rpcUrl: string;
  contractAddress: string;
  assetDataUrl: string;
  assetRegistryUrl: string;
  cryptoRegistryUrl: string;
  priceUrl: string;
  assetRpcUrl: string;
  assetChainId: number;
  cryptoSymbols: string[];
  cryptoMarketCapFloorUsd: number;
  allowlistOverride?: AllowlistedAsset[];
  cacheTtlMs: number;
  staleTtlMs: number;
  metadataPublic: boolean;
  royaltyReceiver: string;
};

export function getOracleConfig(): OracleConfig {
  const cacheTtlMs = Number(process.env.ORACLE_CACHE_TTL_MS ?? 60_000);
  const staleTtlMs = Number(process.env.ORACLE_STALE_TTL_MS ?? 900_000);
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs <= 0 || !Number.isFinite(staleTtlMs) || staleTtlMs < cacheTtlMs) {
    throw new Error("Oracle cache TTL values are invalid");
  }
  const assetChainId = Number(process.env.ROBINHOOD_ASSET_CHAIN_ID ?? "46630");
  if (!Number.isSafeInteger(assetChainId) || assetChainId <= 0) {
    throw new Error("ROBINHOOD_ASSET_CHAIN_ID must be a positive integer");
  }
  const cryptoMarketCapFloorUsd = Number(process.env.ROBINHOOD_CRYPTO_MARKET_CAP_FLOOR_USD ?? "5000000");
  if (!Number.isFinite(cryptoMarketCapFloorUsd) || cryptoMarketCapFloorUsd < 0) {
    throw new Error("ROBINHOOD_CRYPTO_MARKET_CAP_FLOOR_USD must be non-negative");
  }
  const cryptoSymbols = (process.env.ROBINHOOD_CRYPTO_SYMBOLS?.trim()
    ? process.env.ROBINHOOD_CRYPTO_SYMBOLS.split(",")
    : [...DEFAULT_CRYPTO_SYMBOLS])
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  if (cryptoSymbols.length === 0) throw new Error("ROBINHOOD_CRYPTO_SYMBOLS must not be empty");
  const royaltyReceiver = process.env.ROYALTY_RECEIVER ?? process.env.METADATA_FEE_RECIPIENT;
  if (!royaltyReceiver || !addressPattern.test(royaltyReceiver) || royaltyReceiver === "0x0000000000000000000000000000000000000000") {
    throw new Error("ROYALTY_RECEIVER must be a non-zero EVM address");
  }
  return {
    metadataBaseUrl: required("METADATA_BASE_URL").replace(/\/$/, ""),
    rpcUrl: required("ROBINHOOD_RPC_URL"),
    contractAddress: required("STONKALICIOUS_CONTRACT_ADDRESS"),
    assetDataUrl: required("PUBLIC_ASSET_DATA_URL"),
    assetRegistryUrl: process.env.ROBINHOOD_ASSET_REGISTRY_URL?.trim() ?? "https://api.robinhood.com/rhj/assets",
    cryptoRegistryUrl: process.env.ROBINHOOD_CRYPTO_REGISTRY_URL?.trim() ?? "https://api.dexscreener.com/latest/dex/search",
    priceUrl: process.env.ROBINHOOD_PRICE_URL?.trim() ?? "https://api.robinhood.com/rhj/prices",
    assetRpcUrl: process.env.ROBINHOOD_ASSET_RPC_URL?.trim() ?? required("ROBINHOOD_RPC_URL"),
    assetChainId,
    cryptoSymbols,
    cryptoMarketCapFloorUsd,
    allowlistOverride: process.env.NODE_ENV === "production" ? undefined : parseAllowlistOverride(),
    cacheTtlMs,
    staleTtlMs,
    metadataPublic: process.env.METADATA_PUBLIC === "true",
    royaltyReceiver,
  };
}