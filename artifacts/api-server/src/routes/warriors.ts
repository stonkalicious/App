import { Router, type IRouter } from "express";
import { getOracleConfig } from "../oracle/config";
import { StaleCache } from "../oracle/cache";
import { PublicAssetProvider } from "../oracle/provider";
import { scoreObservation } from "../oracle/scoring";
import type { MetadataResponse, ScoredWarrior } from "../oracle/types";

const router: IRouter = Router();
type OracleContext = {
  config: ReturnType<typeof getOracleConfig>;
  provider: PublicAssetProvider;
  cache: StaleCache<ScoredWarrior & { wallet: string; epoch: string }>;
};

let context: OracleContext | undefined;

function getContext(): OracleContext {
  if (!context) {
    const config = getOracleConfig();
    context = {
      config,
      provider: new PublicAssetProvider(config.assetDataUrl, config.snapshotDataUrl, config.allowlist),
      cache: new StaleCache(config.cacheTtlMs, config.staleTtlMs),
    };
  }
  return context;
}

function metadataFor(tokenId: string, score: ScoredWarrior & { wallet: string; epoch: string }, stale: boolean, config: ReturnType<typeof getOracleConfig>): MetadataResponse {
  const imageLevel = score.level.toLowerCase();
  return {
    name: `Stonkalicious #${tokenId} — ${score.level}`,
    description: "A live performance identity that reflects its owner's qualifying portfolio.",
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

router.get("/warriors/:tokenId", async (req, res) => {
  const tokenId = req.params.tokenId;
  if (!/^[1-9]\d*$/.test(tokenId)) return res.status(400).json({ error: "tokenId must be a positive integer" });
  let oracle: OracleContext;
  try {
    oracle = getContext();
  } catch (error) {
    req.log.error({ error }, "oracle configuration is unavailable");
    return res.status(503).json({ error: "warrior data is not configured" });
  }
  const key = `warrior:${tokenId}`;
  const cached = oracle.cache.get(key);
  if (cached) return res.json(metadataFor(tokenId, cached.value, cached.stale, oracle.config));
  try {
    const snapshot = await oracle.provider.getSnapshot(tokenId);
    const observation = await oracle.provider.getObservation(snapshot.wallet, snapshot);
    const score = { ...scoreObservation(observation), wallet: snapshot.wallet, epoch: snapshot.epoch };
    oracle.cache.set(key, score);
    return res.json(metadataFor(tokenId, score, false, oracle.config));
  } catch (error) {
    req.log.error({ error, tokenId }, "warrior metadata resolution failed");
    const stale = oracle.cache.get(key);
    if (stale) return res.json(metadataFor(tokenId, stale.value, true, oracle.config));
    return res.status(503).json({ error: "warrior data is temporarily unavailable" });
  }
});

export default router;