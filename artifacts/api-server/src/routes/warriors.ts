import { Router, type IRouter, type Request, type Response } from "express";
import { getOracleConfig } from "../oracle/config";
import { StaleCache } from "../oracle/cache";
import { ContractSnapshotProvider, PublicAssetProvider } from "../oracle/provider";
import { scoreObservation } from "../oracle/scoring";
import type { MetadataResponse, ScoredWarrior } from "../oracle/types";

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
      provider: new PublicAssetProvider(config.assetDataUrl, config.allowlist),
      cache: new StaleCache(config.cacheTtlMs, config.staleTtlMs),
    };
  }
  return context;
}

function metadataFor(tokenId: string, score: ScoredWarrior & { wallet: string; epoch: string }, stale: boolean, config: ReturnType<typeof getOracleConfig>): MetadataResponse {
  const imageLevel = score.stage;
  return {
    name: `Stonkalicious #${tokenId} — ${score.level}`,
    description: "A live performance identity that reflects its owner's qualifying Robinhood Chain coin bag.",
    image: `${config.metadataBaseUrl}/images/${imageLevel}.png`,
    external_url: `${config.metadataBaseUrl}/warriors/${tokenId}`,
    attributes: [
      { trait_type: "Level", value: score.level },
      { trait_type: "Current value (USD)", value: score.currentValueUsd },
      { trait_type: "ROI (%)", value: score.roiPct ?? "pending" },
      { trait_type: "Drawdown (%)", value: score.drawdownPct ?? "pending" },
      { trait_type: "Wallet", value: score.wallet },
      { trait_type: "Snapshot epoch", value: score.epoch },
      { trait_type: "Data status", value: stale ? "stale" : "fresh" },
    ],
    properties: { wallet: score.wallet, epoch: score.epoch, observedAt: score.observedAt, stale },
  };
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
      return res.json(metadataFor(tokenId, cached.value, cached.stale, oracle.config));
    }
    const observation = await oracle.provider.getObservation(snapshot.wallet, snapshot);
    const score = { ...scoreObservation(observation), wallet: snapshot.wallet, epoch: snapshot.epoch };
    oracle.cache.set(key, score);
    return res.json(metadataFor(tokenId, score, false, oracle.config));
  } catch (error) {
    req.log.warn({ route: "nft-metadata" }, "NFT metadata resolution failed");
    const stale = oracle.cache.get(key);
    if (stale && (!snapshot || matchesSnapshot(stale.value, snapshot))) {
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
  return res.json({
    name: "Stonkalicious",
    description: "A live performance identity that reflects its owner's qualifying Robinhood Chain coin bag.",
    image: `${oracle.config.metadataBaseUrl}/images/plumber.png`,
    external_link: oracle.config.metadataBaseUrl,
    seller_fee_basis_points: 0,
    fee_recipient: oracle.config.feeRecipient,
  });
});

router.get("/contract", (req, res) => res.redirect(307, "/api/collection"));

export default router;