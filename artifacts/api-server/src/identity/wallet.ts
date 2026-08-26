import { getAddress, verifyMessage } from "ethers";

export function canonicalWallet(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_wallet");
  try {
    return getAddress(value).toLowerCase();
  } catch {
    throw new Error("invalid_wallet");
  }
}

export function walletMessage(wallet: string, challengeId: string, expiresAt: number): string {
  return [
    "Stonkalicious wallet verification",
    "",
    `Wallet: ${wallet}`,
    `Challenge: ${challengeId}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "Sign this message to prove control of this wallet.",
    "This does not approve a transaction, move assets, or grant custody.",
  ].join("\n");
}

export function verifyWalletSignature(message: string, signature: unknown, wallet: string): boolean {
  if (typeof signature !== "string") return false;
  try {
    return verifyMessage(message, signature).toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}