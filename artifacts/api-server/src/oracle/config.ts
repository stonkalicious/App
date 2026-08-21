import type { AllowlistedAsset } from "./types";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the oracle service`);
  return value;
}

function parseAllowlist(): AllowlistedAsset[] {
  const raw = required("ROBINHOOD_ASSET_ALLOWLIST_JSON");
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
    if (!symbol || !addressPattern.test(contractAddress) || !["stock", "etf", "coin"].includes(String(kind))) {
      throw new Error(`Allowlist entry ${index} must contain symbol, EVM contractAddress, and kind`);
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
  assetDataUrl: string;
  snapshotDataUrl: string;
  allowlist: AllowlistedAsset[];
  cacheTtlMs: number;
  staleTtlMs: number;
};

export function getOracleConfig(): OracleConfig {
  const cacheTtlMs = Number(process.env.ORACLE_CACHE_TTL_MS ?? 60_000);
  const staleTtlMs = Number(process.env.ORACLE_STALE_TTL_MS ?? 900_000);
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs <= 0 || !Number.isFinite(staleTtlMs) || staleTtlMs < cacheTtlMs) {
    throw new Error("Oracle cache TTL values are invalid");
  }
  return {
    metadataBaseUrl: required("METADATA_BASE_URL").replace(/\/$/, ""),
    assetDataUrl: required("PUBLIC_ASSET_DATA_URL"),
    snapshotDataUrl: required("CONTRACT_SNAPSHOT_DATA_URL"),
    allowlist: parseAllowlist(),
    cacheTtlMs,
    staleTtlMs,
  };
}