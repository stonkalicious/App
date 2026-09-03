import { Router, type IRouter } from "express";
import { getOracleConfig } from "../oracle/config";
import { getAllowlistedAssets } from "../oracle/registry";
import type { AllowlistedAsset } from "../oracle/types";

const router: IRouter = Router();
const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const balanceOfSelector = "0x70a08231";
const maxPriceAgeMs = 15 * 60 * 1000;
const maxClockSkewMs = 5 * 60 * 1000;

type PriceQuote = {
  tokenSymbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  currency?: unknown;
  generatedAt?: unknown;
};

function isWallet(value: string): boolean {
  return walletPattern.test(value);
}

function encodeAddress(address: string): string {
  if (!isWallet(address)) throw new Error("wallet must be an EVM address");
  return address.slice(2).padStart(64, "0");
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Robinhood Chain RPC returned ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Robinhood Chain RPC returned invalid JSON");
  const result = body as { result?: unknown; error?: unknown };
  if (result.error || result.result === undefined) throw new Error("Robinhood Chain RPC request failed");
  return result.result;
}

function parseUint256(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("Robinhood Chain RPC returned an invalid token balance");
  }
  return BigInt(value);
}

function balanceToNumber(balance: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const fraction = (balance % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  const value = Number(fraction ? `${whole}.${fraction}` : whole.toString());
  if (!Number.isFinite(value) || value < 0) throw new Error("Token balance exceeds supported numeric range");
  return value;
}

function quotePrice(quote: PriceQuote, multiplier = 1): { price: number; observedAt: string } {
  if (quote.currency !== "USD" || typeof quote.bid !== "string" || typeof quote.ask !== "string") {
    throw new Error("Robinhood price feed returned an invalid quote");
  }
  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  const generatedAt = typeof quote.generatedAt === "string" ? Date.parse(quote.generatedAt) : NaN;
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid || !Number.isFinite(generatedAt)) {
    throw new Error("Robinhood price feed returned an invalid price");
  }
  const now = Date.now();
  if (now - generatedAt > maxPriceAgeMs || generatedAt - now > maxClockSkewMs) {
    throw new Error("Robinhood price feed is stale");
  }
  return { price: ((bid + ask) / 2) * multiplier, observedAt: new Date(generatedAt).toISOString() };
}

async function loadStockPrice(asset: AllowlistedAsset, priceUrl: string): Promise<{ price: number; observedAt: string }> {
  const response = await fetch(`${priceUrl}/${encodeURIComponent(asset.symbol)}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Robinhood price feed returned ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !Array.isArray((body as { quotes?: unknown }).quotes)) {
    throw new Error("Robinhood price feed returned invalid data");
  }
  const quote = (body as { quotes: unknown[] }).quotes.find((item) =>
    item && typeof item === "object" &&
    (item as PriceQuote).tokenSymbol?.toString().trim().toUpperCase() === asset.symbol,
  ) as PriceQuote | undefined;
  if (!quote) throw new Error(`No official price is available for ${asset.symbol}`);
  return quotePrice(quote, asset.priceMultiplier ?? 1);
}

async function assetPrice(asset: AllowlistedAsset, priceUrl: string): Promise<{ price: number; observedAt: string }> {
  if (asset.kind === "crypto") {
    if (!asset.currentPriceUsd || !Number.isFinite(asset.currentPriceUsd) || asset.currentPriceUsd <= 0) {
      throw new Error(`No verified crypto price is available for ${asset.symbol}`);
    }
    return { price: asset.currentPriceUsd, observedAt: new Date().toISOString() };
  }
  return loadStockPrice(asset, priceUrl);
}

router.get("/assets/:wallet", async (req, res) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  const wallet = req.params.wallet;
  if (!isWallet(wallet)) return res.status(400).json({ error: "invalid wallet" });

  try {
    const config = getOracleConfig();
    const assets = await getAllowlistedAssets(config);
    const chainId = await rpcCall(config.assetRpcUrl, "eth_chainId", []);
    if (chainId !== `0x${config.assetChainId.toString(16)}`) {
      throw new Error(`asset endpoint is not connected to chain ${config.assetChainId}`);
    }
    const resolved = await Promise.all(assets.map(async (asset) => {
      const data = await rpcCall(
        config.assetRpcUrl,
        "eth_call",
        [{ to: asset.contractAddress, data: `${balanceOfSelector}${encodeAddress(wallet)}` }, "latest"],
      );
      const quantity = balanceToNumber(parseUint256(data), asset.decimals);
      if (quantity === 0) {
        return { symbol: asset.symbol, kind: asset.kind, contractAddress: asset.contractAddress.toLowerCase(), quantity, valueUsd: 0 };
      }
      const { price, observedAt } = await assetPrice(asset, config.priceUrl);
      return {
        symbol: asset.symbol,
        kind: asset.kind,
        contractAddress: asset.contractAddress.toLowerCase(),
        quantity,
        valueUsd: Math.round(quantity * price * 100) / 100,
        observedAt,
      };
    }));
    const observedAt = resolved
      .map((asset) => asset.observedAt)
      .filter((value): value is string => typeof value === "string")
      .sort()
      .at(-1) ?? new Date().toISOString();
    const currentValueUsd = Math.round(resolved.reduce((total, asset) => total + asset.valueUsd, 0) * 100) / 100;
    return res.json({
      wallet,
      currentValueUsd,
      highWaterMarkUsd: currentValueUsd,
      lowWaterMarkUsd: currentValueUsd,
      maxDrawdownPct: 0,
      recoveredFromDrawdown: false,
      observedAt,
      assets: resolved.map(({ observedAt: _observedAt, ...asset }) => asset),
    });
  } catch (error) {
    req.log.warn({ route: "public-assets" }, "public asset observation failed");
    return res.status(503).json({ error: "public asset data is temporarily unavailable" });
  }
});

export default router;