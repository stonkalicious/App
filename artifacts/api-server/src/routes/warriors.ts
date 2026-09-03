import { Router, type IRouter, type Request, type Response } from "express";
import { getOracleConfig } from "../oracle/config";
import { StaleCache } from "../oracle/cache";
import { ContractSnapshotProvider, PublicAssetProvider } from "../oracle/provider";
import { scoreObservation } from "../oracle/scoring";
import type { MetadataResponse, ScoredWarrior } from "../oracle/types";
import { WARRIOR_ARTWORK_MAP } from "@workspace/warrior-config";
import { getAllowlistedAssets } from "../oracle/registry";

const router: IRouter = Router();
type OracleContext = {
  config: ReturnType<typeof getOracleConfig>;
  contract: ContractSnapshotProvider;
  provider: PublicAssetProvider;
  cache: StaleCache<ScoredWarrior & { wallet: string; epoch: string }>;
};

let context: OracleContext | undefined;

function getContext(): OracleContext {
  if (!context) {
    const config = getOracleConfig();
    context = {
      config,
      contract: new ContractSnapshotProvider(config.rpcUrl, config.contractAddress),
      provider: new PublicAssetProvider(config.assetDataUrl, () => getAllowlistedAssets(config)),
      cache: new StaleCache(config.cacheTtlMs, config.staleTtlMs),
    };
  }
  return context;
}

function metadataFor(tokenId: string, score: ScoredWarrior & { wallet: string; epoch: string }, stale: boolean, config: ReturnType<typeof getOracleConfig>): MetadataResponse {
  const artwork = WARRIOR_ARTWORK_MAP[score.stage];
  if (artwork.status === "blocked") {
    throw new Error(artwork.blocker ?? `Artwork is unavailable for ${artwork.level}`);
  }
  return {
    name: `Stonkalicious #${tokenId} — ${score.level}`,
    description: "An experimental digital collectible whose level may be calculated from its owner's qualifying Robinhood Chain coin data when metadata is enabled. Data may be delayed, unavailable, or change.",
    image: `${config.metadataBaseUrl}/images/${artwork.filename}`,
    external_url: `${config.metadataBaseUrl}/warriors/${tokenId}`,
    attributes: [
      { trait_type: "Level", value: score.level },
      { trait_type: "Eligible coin value (USD)", value: score.currentValueUsd },
      { trait_type: "Snapshot change (%)", value: score.roiPct ?? "pending" },
      { trait_type: "Drawdown (%)", value: score.drawdownPct ?? "pending" },
      { trait_type: "Wallet", value: score.wallet },
      { trait_type: "Snapshot epoch", value: score.epoch },
      { trait_type: "Data status", value: stale ? "stale" : "fresh" },
    ],
    properties: { wallet: score.wallet, epoch: score.epoch, observedAt: score.observedAt, stale },
  };
}

function blockedArtworkResponse(res: Response, stage: ScoredWarrior["stage"]) {
  const artwork = WARRIOR_ARTWORK_MAP[stage];
  return res.status(503).json({
    error: "warrior artwork is not available",
    level: artwork.level,
    blocker: artwork.blocker ?? "Artwork is unavailable",
  });
}

function lockedResponse(res: Response) {
  return res.status(404).json({ error: "metadata is not public" });
}

function matchesSnapshot(
  score: ScoredWarrior & { wallet: string; epoch: string },
  snapshot: { wallet: string; epoch: string },
): boolean {
  return score.epoch === snapshot.epoch && score.wallet.toLowerCase() === snapshot.wallet.toLowerCase();
}

async function resolveMetadata(req: Request, res: Response, tokenId: string) {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  if (!/^[1-9]\d*$/.test(tokenId)) return res.status(400).json({ error: "tokenId must be a positive integer" });
  let oracle: OracleContext;
  try {
    oracle = getContext();
  } catch (error) {
     req.log.warn({ route: "nft-metadata" }, "oracle configuration is unavailable");
     return res.status(503).json({ error: "NFT data is not configured" });
  }
  if (!oracle.config.metadataPublic) return lockedResponse(res);
  const key = `warrior:${tokenId}`;
  let snapshot: Awaited<ReturnType<ContractSnapshotProvider["getSnapshot"]>> | undefined;
  try {
    snapshot = await oracle.contract.getSnapshot(tokenId);
    const cached = oracle.cache.get(key);
    if (cached && matchesSnapshot(cached.value, snapshot)) {
      if (WARRIOR_ARTWORK_MAP[cached.value.stage].status === "blocked") {
        return blockedArtworkResponse(res, cached.value.stage);
      }
      return res.json(metadataFor(tokenId, cached.value, cached.stale, oracle.config));
    }
    const observation = await oracle.provider.getObservation(snapshot.wallet, snapshot);
    const score = { ...scoreObservation(observation), wallet: snapshot.wallet, epoch: snapshot.epoch };
    oracle.cache.set(key, score);
    if (WARRIOR_ARTWORK_MAP[score.stage].status === "blocked") {
      return blockedArtworkResponse(res, score.stage);
    }
    return res.json(metadataFor(tokenId, score, false, oracle.config));
  } catch (error) {
    req.log.warn({ route: "nft-metadata" }, "NFT metadata resolution failed");
    const stale = oracle.cache.get(key);
    if (stale && (!snapshot || matchesSnapshot(stale.value, snapshot))) {
      if (WARRIOR_ARTWORK_MAP[stale.value.stage].status === "blocked") {
        return blockedArtworkResponse(res, stale.value.stage);
      }
      return res.json(metadataFor(tokenId, stale.value, true, oracle.config));
    }
    return res.status(503).json({ error: "NFT data is temporarily unavailable" });
  }
}

router.get("/warriors/:tokenId", (req, res) => resolveMetadata(req, res, req.params.tokenId));
router.get("/token/:tokenId", (req, res) => resolveMetadata(req, res, req.params.tokenId));

router.get("/collection", (req, res) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  let oracle: OracleContext;
  try {
    oracle = getContext();
  } catch {
    req.log.warn({ route: "collection-metadata" }, "oracle configuration is unavailable");
    return res.status(503).json({ error: "metadata is not configured" });
  }
  if (!oracle.config.metadataPublic) return lockedResponse(res);
  if (WARRIOR_ARTWORK_MAP.plumber.status === "blocked") {
    return blockedArtworkResponse(res, "plumber");
  }
  const collectionArtwork = WARRIOR_ARTWORK_MAP.plumber;
  return res.json({
    name: "Stonkalicious",
    description: "An experimental digital collectible whose level may be calculated from its owner's qualifying Robinhood Chain coin data when metadata is enabled. Data may be delayed, unavailable, or change.",
    image: `${oracle.config.metadataBaseUrl}/images/${collectionArtwork.filename}`,
    external_link: oracle.config.metadataBaseUrl,
    seller_fee_basis_points: 500,
    fee_recipient: oracle.config.royaltyReceiver,
  });
});

router.get("/contract", (req, res) => res.redirect(307, "/api/collection"));

export default router;
