import type { AllowlistedAsset, AssetKind, ContractSnapshot, PortfolioObservation } from "./types";
import { id } from "ethers";

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

const OWNER_OF_SELECTOR = "0x6352211e";
const SNAPSHOT_OF_SELECTOR = "0x364e5ebe";
const SNAPSHOT_WRITE_EPOCH_SELECTOR = id("snapshotWriteEpoch(uint256)").slice(0, 10);
const WARRIOR_BY_X_PROFILE_SELECTOR = id("warriorByXProfile(bytes32)").slice(0, 10);
const MINTED_BY_WALLET_SELECTOR = id("mintedByWallet(address)").slice(0, 10);
const MINT_SIGNER_SELECTOR = id("mintSigner()").slice(0, 10);

function isWallet(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isContractAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name} from public asset provider`);
  return value;
}

function encodeUint256(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new Error("Token ID must be a positive integer");
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeBytes32(value: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("Profile hash must be bytes32");
  return value.slice(2);
}

function encodeAddress(value: string): string {
  if (!isWallet(value)) throw new Error("Wallet must be an EVM address");
  return value.slice(2).padStart(64, "0");
}

function decodeWord(data: string, index: number): string {
  if (!/^0x[0-9a-fA-F]+$/.test(data)) throw new Error("Contract RPC returned invalid ABI data");
  const word = data.slice(2 + index * 64, 2 + (index + 1) * 64);
  if (word.length !== 64) throw new Error("Contract RPC returned incomplete ABI data");
  return word;
}

async function rpcCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Robinhood Chain RPC returned ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Robinhood Chain RPC returned invalid JSON");
  const result = body as { result?: unknown; error?: unknown };
  if (result.error || typeof result.result !== "string") throw new Error("Robinhood Chain RPC eth_call failed");
  return result.result;
}

export class ContractSnapshotProvider {
  constructor(private readonly rpcUrl: string, private readonly contractAddress: string) {
    if (!isContractAddress(contractAddress)) throw new Error("Invalid Stonkalicious contract address");
  }

  // This adapter is intentionally read-only. A snapshot writer must read the
  // returned epoch and pass it as expectedEpoch to
  // recordStartingBagValue(tokenId, expectedEpoch, startingBagValue).
  async getSnapshot(tokenId: string): Promise<ContractSnapshot> {
    const encodedTokenId = encodeUint256(tokenId);
    const ownerData = await rpcCall(this.rpcUrl, this.contractAddress, `${OWNER_OF_SELECTOR}${encodedTokenId}`);
    const wallet = `0x${decodeWord(ownerData, 0).slice(24)}`;
    if (!isWallet(wallet)) throw new Error("Contract ownerOf returned an invalid wallet");

    const snapshotData = await rpcCall(this.rpcUrl, this.contractAddress, `${SNAPSHOT_OF_SELECTOR}${encodedTokenId}`);
    const acquiredAtSeconds = BigInt(`0x${decodeWord(snapshotData, 1)}`);
    const epoch = BigInt(`0x${decodeWord(snapshotData, 2)}`);
    const startingBagValueUsd = BigInt(`0x${decodeWord(snapshotData, 3)}`);
    const writeEpochData = await rpcCall(this.rpcUrl, this.contractAddress, `${SNAPSHOT_WRITE_EPOCH_SELECTOR}${encodedTokenId}`);
    const writeEpoch = BigInt(`0x${decodeWord(writeEpochData, 0)}`);
    if (acquiredAtSeconds === 0n || epoch === 0n) throw new Error("Contract snapshot is not initialized");
    if (writeEpoch > epoch) throw new Error("Contract snapshot write epoch is invalid");
    if (startingBagValueUsd > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Contract snapshot value exceeds safe numeric range");
    }
    const acquiredAt = new Date(Number(acquiredAtSeconds) * 1000);
    if (!Number.isFinite(acquiredAt.getTime())) throw new Error("Contract snapshot has an invalid timestamp");
    return {
      tokenId,
      wallet,
      epoch: epoch.toString(),
      acquiredAt: acquiredAt.toISOString(),
      startingBagValueUsd: Number(startingBagValueUsd),
      snapshotRecorded: writeEpoch === epoch,
    };
  }

  async getWarriorByXProfile(profileHash: string): Promise<bigint> {
    const data = await rpcCall(this.rpcUrl, this.contractAddress, `${WARRIOR_BY_X_PROFILE_SELECTOR}${encodeBytes32(profileHash)}`);
    return BigInt(`0x${decodeWord(data, 0)}`);
  }

  async getMintedByWallet(wallet: string): Promise<bigint> {
    const data = await rpcCall(this.rpcUrl, this.contractAddress, `${MINTED_BY_WALLET_SELECTOR}${encodeAddress(wallet)}`);
    return BigInt(`0x${decodeWord(data, 0)}`);
  }

  async getMintSigner(): Promise<string> {
    const data = await rpcCall(this.rpcUrl, this.contractAddress, MINT_SIGNER_SELECTOR);
    const signer = `0x${decodeWord(data, 0).slice(24)}`;
    if (!isWallet(signer)) throw new Error("Contract mintSigner returned an invalid address");
    return signer;
  }

  async getChainId(): Promise<bigint> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Robinhood Chain RPC returned ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") throw new Error("Robinhood Chain RPC returned invalid JSON");
    const result = body as { result?: unknown; error?: unknown };
    if (result.error || typeof result.result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result.result)) {
      throw new Error("Robinhood Chain RPC eth_chainId failed");
    }
    return BigInt(result.result);
  }
}

export class PublicAssetProvider {
  constructor(
    private readonly assetDataUrl: string,
    private readonly allowlist: AllowlistedAsset[],
  ) {}

  async getObservation(wallet: string, snapshot: ContractSnapshot): Promise<PortfolioObservation> {
    if (!isWallet(wallet) || wallet.toLowerCase() !== snapshot.wallet.toLowerCase()) throw new Error("Snapshot owner mismatch");
    if (!snapshot.snapshotRecorded) throw new Error("Contract snapshot baseline is not recorded");
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
       const normalizedKind: AssetKind = "coin";
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