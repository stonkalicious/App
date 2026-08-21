import type { AllowlistedAsset, AssetKind, ContractSnapshot, PortfolioObservation } from "./types";

type ProviderResponse = {
  wallet?: unknown;
  currentValueUsd?: unknown;
  startingValueUsd?: unknown;
  highWaterMarkUsd?: unknown;
  lowWaterMarkUsd?: unknown;
  maxDrawdownPct?: unknown;
  recoveredFromDrawdown?: unknown;
  observedAt?: unknown;
  assets?: unknown;
};

function isWallet(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name} from public asset provider`);
  return value;
}

export class PublicAssetProvider {
  constructor(
    private readonly assetDataUrl: string,
    private readonly snapshotDataUrl: string,
    private readonly allowlist: AllowlistedAsset[],
  ) {}

  async getSnapshot(tokenId: string): Promise<ContractSnapshot> {
    const response = await fetch(`${this.snapshotDataUrl}/${encodeURIComponent(tokenId)}`);
    if (!response.ok) throw new Error(`Contract snapshot provider returned ${response.status}`);
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") throw new Error("Contract snapshot provider returned invalid data");
    const candidate = value as Record<string, unknown>;
    if (!isWallet(candidate.wallet) || typeof candidate.epoch !== "string" || typeof candidate.acquiredAt !== "string") {
      throw new Error("Contract snapshot provider returned an incomplete snapshot");
    }
    return {
      tokenId,
      wallet: candidate.wallet,
      epoch: candidate.epoch,
      acquiredAt: candidate.acquiredAt,
      startingBagValueUsd: numberValue(candidate.startingBagValueUsd ?? 0, "startingBagValueUsd"),
    };
  }

  async getObservation(wallet: string, snapshot: ContractSnapshot): Promise<PortfolioObservation> {
    if (!isWallet(wallet) || wallet.toLowerCase() !== snapshot.wallet.toLowerCase()) throw new Error("Snapshot owner mismatch");
    const response = await fetch(`${this.assetDataUrl}/${wallet}`);
    if (!response.ok) throw new Error(`Public asset provider returned ${response.status}`);
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") throw new Error("Public asset provider returned invalid data");
    const candidate = value as ProviderResponse;
    if (!isWallet(candidate.wallet) || candidate.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error("Public asset provider wallet mismatch");

    const assets = Array.isArray(candidate.assets) ? candidate.assets : [];
    const normalizedAssets = assets.map((asset) => {
      if (!asset || typeof asset !== "object") throw new Error("Public asset provider returned an invalid asset");
      const item = asset as Record<string, unknown>;
      const symbol = typeof item.symbol === "string" ? item.symbol.toUpperCase() : "";
      const valueUsd = numberValue(item.valueUsd, `${symbol || "asset"}.valueUsd`);
      const kind = item.kind;
      const contractAddress = typeof item.contractAddress === "string" ? item.contractAddress.toLowerCase() : "";
      const configured = this.allowlist.find((entry) =>
        entry.symbol === symbol &&
        entry.contractAddress.toLowerCase() === contractAddress &&
        entry.kind === kind,
      );
      const capped = configured?.maxContributionUsd !== undefined && valueUsd > configured.maxContributionUsd;
      const included = Boolean(configured) && !capped;
      const normalizedKind: AssetKind = kind === "stock" || kind === "etf" || kind === "coin" ? kind : "coin";
      return {
        symbol: symbol || "UNKNOWN",
        kind: normalizedKind,
        valueUsd,
        included,
        ...(!included ? { exclusionReason: capped ? "contribution cap exceeded" : "not allowlisted" } : {}),
      };
    });

    return {
      wallet,
      currentValueUsd: numberValue(candidate.currentValueUsd, "currentValueUsd"),
      startingValueUsd: snapshot.startingBagValueUsd,
      highWaterMarkUsd: numberValue(candidate.highWaterMarkUsd ?? candidate.currentValueUsd, "highWaterMarkUsd"),
      lowWaterMarkUsd: numberValue(candidate.lowWaterMarkUsd ?? candidate.currentValueUsd, "lowWaterMarkUsd"),
      maxDrawdownPct: numberValue(candidate.maxDrawdownPct ?? 0, "maxDrawdownPct"),
      recoveredFromDrawdown: candidate.recoveredFromDrawdown === true,
      observedAt: typeof candidate.observedAt === "string" ? candidate.observedAt : new Date().toISOString(),
      assets: normalizedAssets,
    };
  }
}