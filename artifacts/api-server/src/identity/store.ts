import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "stonkalicious_identity";
const MAX_STORE_SIZE = 10_000;

export type IdentityStatus = "wallet_pending" | "oauth_pending" | "ready" | "failed";

export type WalletChallenge = {
  id: string;
  sessionId: string;
  wallet: string;
  message: string;
  expiresAt: number;
  verifiedAt?: number;
};

export type MintAuthorization = {
  id: string;
  sessionId: string;
  expiresAt: number;
  consumedAt?: number;
  payload: {
    wallet: string;
    quantity: 1;
    profileHash: string;
    challengeId: string;
    nonce: string;
    deadline: string;
    signature: string;
    mintPriceWei: string;
  };
};

export type IdentitySession = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: IdentityStatus;
  wallet?: string;
  challengeId?: string;
  oauth?: {
    stateHash: string;
    codeVerifier: string;
    createdAt: number;
    usedAt?: number;
  };
  profileHash?: string;
  authorizationId?: string;
  errorCode?: string;
};

const sessions = new Map<string, IdentitySession>();
const challenges = new Map<string, WalletChallenge>();
const authorizations = new Map<string, MintAuthorization>();
const rateWindows = new Map<string, { startedAt: number; count: number }>();
const profileReservations = new Map<string, { sessionId: string; expiresAt: number }>();
const walletReservations = new Map<string, { sessionId: string; expiresAt: number }>();

function compactStore() {
  if (sessions.size <= MAX_STORE_SIZE && challenges.size <= MAX_STORE_SIZE && authorizations.size <= MAX_STORE_SIZE) return;
  const now = Date.now();
  for (const [id, value] of sessions) if (value.expiresAt <= now) sessions.delete(id);
  for (const [id, value] of challenges) if (value.expiresAt <= now) challenges.delete(id);
  for (const [id, value] of authorizations) if (value.expiresAt <= now) authorizations.delete(id);
  for (const [id, value] of profileReservations) if (value.expiresAt <= now) profileReservations.delete(id);
  for (const [id, value] of walletReservations) if (value.expiresAt <= now) walletReservations.delete(id);
}

export function randomId(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function signCookie(sessionId: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

export function verifyCookie(value: unknown, secret: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return undefined;
  const expected = createHmac("sha256", secret).update(sessionId).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  return sessionId;
}

export function getOrCreateSession(sessionId: string | undefined, ttlMs: number): IdentitySession {
  compactStore();
  const now = Date.now();
  const existing = sessionId ? sessions.get(sessionId) : undefined;
  if (existing && existing.expiresAt > now) return existing;
  const session: IdentitySession = {
    id: randomId(24),
    createdAt: now,
    expiresAt: now + ttlMs,
    status: "wallet_pending",
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string | undefined): IdentitySession | undefined {
  if (!sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function saveChallenge(challenge: WalletChallenge) {
  challenges.set(challenge.id, challenge);
}

export function getChallenge(id: string): WalletChallenge | undefined {
  const challenge = challenges.get(id);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    challenges.delete(id);
    return undefined;
  }
  return challenge;
}

export function saveAuthorization(authorization: MintAuthorization) {
  authorizations.set(authorization.id, authorization);
}

export function getAuthorization(id: string): MintAuthorization | undefined {
  const authorization = authorizations.get(id);
  if (!authorization || authorization.expiresAt <= Date.now()) {
    authorizations.delete(id);
    return undefined;
  }
  return authorization;
}

export function reserveClaim(profileHash: string, wallet: string, sessionId: string, expiresAt: number): boolean {
  const now = Date.now();
  const existingProfile = profileReservations.get(profileHash);
  const existingWallet = walletReservations.get(wallet);
  if ((existingProfile && existingProfile.expiresAt > now && existingProfile.sessionId !== sessionId)
    || (existingWallet && existingWallet.expiresAt > now && existingWallet.sessionId !== sessionId)) {
    return false;
  }
  profileReservations.set(profileHash, { sessionId, expiresAt });
  walletReservations.set(wallet, { sessionId, expiresAt });
  return true;
}

export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}