import type { AllowlistedAsset } from "./types";
import type { OracleConfig } from "./config";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const excludedSymbols = new Set([
  "WETH", "USDG", "USDC", "USDT", "USDS", "DAI", "BUSD", "FDUSD", "USDE",
  "PYUSD", "TUSD", "GUSD", "EURC", "EURT", "FRAX", "CRVUSD",
]);
const stableNamePattern = /\b(stablecoin|wrapped|bridged|peg|usd coin|tether)\b/i;
const bridgedNamePattern = /\b(wrapped|bridged|wormhole|multichain|layerzero)\b/i;
const codePattern = /^0x[0-9a-fA-F]+$/;
const registryTtlMs = 5 * 60 * 1000;
const codeSelector = "eth_getCode";

type OfficialAsset = {
  tokenSymbol?: unknown;
  tokenName?: unknown;
  deployments?: unknown;
  tokenDecimals?: unknown;
  currentMultiplier?: unknown;
  status?: unknown;
};

type CryptoPair = {
  chainId?: unknown;
  baseToken?: { address?: unknown; symbol?: unknown; name?: unknown };
  marketCap?: unknown;
  priceUsd?: unknown;
};

type CacheEntry = {
  key: string;
  expiresAt: number;
  value: AllowlistedAsset[];
};

let cache: CacheEntry | undefined;
let pending: { key: string; promise: Promise<AllowlistedAsset[]> } | undefined;

function isAddress(value: unknown): value is string {
  return typeof value === "string" && addressPattern.test(value);
}

function isExcluded(symbol: string, name: string): boolean {
  return excludedSymbols.has(symbol) || stableNamePattern.test(`${symbol} ${name}`);
}

function numberFrom(value: unknown, name: string, min = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw new Error(`Invalid ${name} in asset registry`);
  return parsed;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Asset registry returned ${response.status}`);
  return response.json();
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Asset RPC returned ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Asset RPC returned invalid JSON");
  const result = body as { result?: unknown; error?: unknown };
  if (result.error || result.result === undefined) throw new Error("Asset RPC request failed");
  return result.result;
}

async function assertAssetChain(config: OracleConfig): Promise<void> {
  const result = await rpcCall(config.assetRpcUrl, "eth_chainId", []);
  const expected = `0x${config.assetChainId.toString(16)}`;
  if (result !== expected) throw new Error(`Asset RPC is not configured for chain ${config.assetChainId}`);
}

function officialAssets(body: unknown, config: OracleConfig): AllowlistedAsset[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { assets?: unknown }).assets)) {
    throw new Error("Official Robinhood asset registry returned invalid data");
  }
  const result: AllowlistedAsset[] = [];
  for (const raw of (body as { assets: unknown[] }).assets) {
    if (!raw || typeof raw !== "object") continue;
    const asset = raw as OfficialAsset;
    const symbol = typeof asset.tokenSymbol === "string" ? asset.tokenSymbol.trim().toUpperCase() : "";
    const name = typeof asset.tokenName === "string" ? asset.tokenName.trim() : "";
    if (!symbol || asset.status !== "ASSET_STATUS_ACTIVE" || isExcluded(symbol, name)) continue;
    const deployments = Array.isArray(asset.deployments) ? asset.deployments : [];
    const deployment = deployments.find((candidate) => {
      if (!candidate || typeof candidate !== "object") return false;
      const item = candidate as { chainId?: unknown; contractAddress?: unknown };
      return item.chainId === config.assetChainId && isAddress(item.contractAddress);
    }) as { contractAddress: string } | undefined;
    if (!deployment) continue;
    const decimals = Number(asset.tokenDecimals ?? 18);
    const multiplier = Number(asset.currentMultiplier ?? 1);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error(`Official Robinhood asset ${symbol} has invalid decimals or multiplier`);
    }
    result.push({
      symbol,
      contractAddress: deployment.contractAddress,
      kind: "stock",
      decimals,
      priceMultiplier: multiplier,
    });
  }
  if (result.length === 0) throw new Error(`Official Robinhood registry has no assets on chain ${config.assetChainId}`);
  return result;
}

async function cryptoAsset(symbol: string, config: OracleConfig): Promise<AllowlistedAsset | undefined> {
  const url = new URL(config.cryptoRegistryUrl);
  url.searchParams.set("q", symbol);
  const body = await fetchJson(url.toString());
  if (!body || typeof body !== "object" || !Array.isArray((body as { pairs?: unknown }).pairs)) return undefined;
  const pairs = (body as { pairs: unknown[] }).pairs
    .filter((pair): pair is CryptoPair => Boolean(pair && typeof pair === "object"))
    .filter((pair) =>
      pair.chainId === "robinhood" &&
      pair.baseToken?.symbol?.toString().trim().toUpperCase() === symbol &&
      isAddress(pair.baseToken.address) &&
      !bridgedNamePattern.test(pair.baseToken.name?.toString() ?? ""),
    )
    .sort((left, right) => Number(right.marketCap ?? 0) - Number(left.marketCap ?? 0));
  const pair = pairs[0];
  if (!pair || !isAddress(pair.baseToken?.address)) return undefined;
  const marketCapUsd = typeof pair.marketCap === "number" ? pair.marketCap : Number(pair.marketCap);
  if (!Number.isFinite(marketCapUsd) || marketCapUsd < config.cryptoMarketCapFloorUsd) return undefined;
  const priceUsd = numberFrom(pair.priceUsd, `${symbol}.priceUsd`, Number.MIN_VALUE);
  const code = await rpcCall(config.assetRpcUrl, codeSelector, [pair.baseToken.address, "latest"]);
  if (typeof code !== "string" || !codePattern.test(code) || code === "0x") return undefined;
  return {
    symbol,
    contractAddress: pair.baseToken.address,
    kind: "crypto",
    decimals: 18,
    currentPriceUsd: priceUsd,
    marketCapUsd,
  };
}

async function loadRegistry(config: OracleConfig): Promise<AllowlistedAsset[]> {
  await assertAssetChain(config);
  const stocks = officialAssets(await fetchJson(config.assetRegistryUrl), config);
  const crypto = await Promise.all(config.cryptoSymbols.map((symbol) => cryptoAsset(symbol, config)));
  const seen = new Set<string>();
  return [...stocks, ...crypto.filter((asset): asset is AllowlistedAsset => Boolean(asset))]
    .filter((asset) => {
      const key = `${asset.symbol}:${asset.contractAddress.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function getAllowlistedAssets(config: OracleConfig): Promise<AllowlistedAsset[]> {
  if (config.allowlistOverride) return config.allowlistOverride;
  const key = JSON.stringify({
    registry: config.assetRegistryUrl,
    rpc: config.assetRpcUrl,
    chain: config.assetChainId,
    price: config.priceUrl,
    crypto: config.cryptoSymbols,
    floor: config.cryptoMarketCapFloorUsd,
  });
  if (cache?.key === key && cache.expiresAt > Date.now()) return cache.value;
  if (pending?.key === key) return pending.promise;
  const promise = loadRegistry(config).then((value) => {
      cache = { key, expiresAt: Date.now() + registryTtlMs, value };
      return value;
    }).finally(() => {
      if (pending?.key === key) pending = undefined;
    });
  pending = { key, promise };
  return promise;
}