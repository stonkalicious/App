import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import type { IdentityConfig } from "./config";
import { ContractSnapshotProvider } from "../oracle/provider";
import type { MintAuthorization } from "./store";
import { randomId, reserveClaim } from "./store";

export const ZERO_PROFILE_HASH = `0x${"00".repeat(32)}`;

const mintTypes = {
  Mint: [
    { name: "wallet", type: "address" },
    { name: "quantity", type: "uint256" },
    { name: "profileHash", type: "bytes32" },
    { name: "challengeId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export async function createMintAuthorization(
  config: IdentityConfig,
  contract: ContractSnapshotProvider,
  wallet: string,
  profileHash: string | undefined,
  challengeId: string,
  sessionId: string,
): Promise<MintAuthorization> {
  const effectiveProfileHash = profileHash ?? ZERO_PROFILE_HASH;
  if ((await contract.getMintedByWallet(wallet)) > 0n) throw new Error("wallet_already_claimed");
  if (effectiveProfileHash !== ZERO_PROFILE_HASH && (await contract.getWarriorByXProfile(effectiveProfileHash)) > 0n) {
    throw new Error("identity_already_bound");
  }

  const signer = new Wallet(config.mintSignerPrivateKey);
  const onChainSigner = await contract.getMintSigner();
  if (signer.address.toLowerCase() !== onChainSigner.toLowerCase()) throw new Error("mint_signer_mismatch");
  const expiresAt = Date.now() + config.authorizationTtlMs;
  if (!reserveClaim(effectiveProfileHash === ZERO_PROFILE_HASH ? undefined : effectiveProfileHash, wallet, sessionId, expiresAt)) {
    throw new Error("claim_in_progress");
  }

  const now = Math.floor(Date.now() / 1000);
  const deadline = now + Math.floor(config.authorizationTtlMs / 1000);
  const nonce = BigInt(`0x${randomBytes(16).toString("hex")}`).toString();
  const chainId = await contract.getChainId();
  const value = {
    wallet,
    quantity: 1,
    profileHash: effectiveProfileHash,
    challengeId,
    nonce,
    deadline,
  } as const;
  const signature = await signer.signTypedData(
    { name: "Stonkalicious", version: "1", chainId, verifyingContract: config.contractAddress },
    mintTypes,
    value,
  );

  return {
    id: randomId(24),
    sessionId,
    expiresAt,
    payload: {
      wallet,
      quantity: 1,
      profileHash: effectiveProfileHash,
      challengeId,
      nonce,
      deadline: String(deadline),
      signature,
      mintPriceWei: config.mintPriceWei,
    },
  };
}