import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { ContractSnapshotProvider } from "../oracle/provider";
import { getIdentityConfig, type IdentityConfig } from "../identity/config";
import {
  allowRequest,
  getAuthorization,
  getChallenge,
  getOrCreateSession,
  getSession,
  hashValue,
  randomId,
  saveAuthorization,
  saveChallenge,
  signCookie,
  SESSION_COOKIE,
  verifyCookie,
} from "../identity/store";
import { canonicalWallet, verifyWalletSignature, walletMessage } from "../identity/wallet";
import { exchangeCode, getStableAccountId, profileHash } from "../identity/x";
import { createMintAuthorization } from "../identity/mint";

const router: IRouter = Router();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
let cachedConfig: IdentityConfig | undefined;

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function config(): IdentityConfig {
  return (cachedConfig ??= getIdentityConfig());
}

function clientKey(req: Request, suffix: string): string {
  return `${req.socket.remoteAddress ?? "unknown"}:${suffix}`;
}

function setSessionCookie(res: Response, sessionId: string, secret: string, maxAge: number) {
  res.cookie(SESSION_COOKIE, signCookie(sessionId, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/identity",
    maxAge,
  });
}

function sessionFromRequest(req: Request, identityConfig: IdentityConfig) {
  const signed = verifyCookie(req.cookies?.[SESSION_COOKIE], identityConfig.sessionSecret);
  return getSession(signed);
}

function redirectToUi(identityConfig: IdentityConfig, status: string, code?: string) {
  const target = new URL(identityConfig.appBaseUrl);
  target.searchParams.set("verification", status);
  if (code) target.searchParams.set("reason", code);
  return target.toString();
}

function failSession(session: ReturnType<typeof getOrCreateSession>, code: string) {
  session.status = "failed";
  session.errorCode = code;
  session.oauth = undefined;
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && [
    "wallet_already_claimed",
    "identity_already_bound",
    "mint_signer_mismatch",
    "claim_in_progress",
  ].includes(error.message)) return error.message;
  return "verification_unavailable";
}

router.post("/identity/challenge", (req, res) => {
  if (!allowRequest(clientKey(req, "challenge"), RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ error: "too_many_attempts", retryAfterSeconds: 600 });
  }
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.status(503).json({ error: "identity_verification_not_configured" });
  }
  let wallet: string;
  try {
    wallet = canonicalWallet(req.body?.wallet);
  } catch {
    return res.status(400).json({ error: "invalid_wallet" });
  }
  const previous = sessionFromRequest(req, identityConfig);
  if (previous?.status === "ready") return res.status(409).json({ error: "identity_already_verified" });
  const session = getOrCreateSession(previous?.id, identityConfig.sessionTtlMs);
  setSessionCookie(res, session.id, identityConfig.sessionSecret, identityConfig.sessionTtlMs);
  const challengeId = `0x${randomBytes(32).toString("hex")}`;
  const expiresAt = Date.now() + identityConfig.challengeTtlMs;
  session.status = "wallet_pending";
  session.wallet = wallet;
  session.challengeId = challengeId;
  session.oauth = undefined;
  session.profileHash = undefined;
  session.authorizationId = undefined;
  session.errorCode = undefined;
  saveChallenge({ id: challengeId, sessionId: session.id, wallet, message: walletMessage(wallet, challengeId, expiresAt), expiresAt });
  return res.json({ challengeId, message: walletMessage(wallet, challengeId, expiresAt), expiresAt: new Date(expiresAt).toISOString() });
});

router.post("/identity/x/start", (req, res) => {
  if (!allowRequest(clientKey(req, "oauth-start"), RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ error: "too_many_attempts", retryAfterSeconds: 600 });
  }
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.status(503).json({ error: "identity_verification_not_configured" });
  }
  const session = sessionFromRequest(req, identityConfig);
  if (!session || !session.wallet || !session.challengeId) return res.status(401).json({ error: "wallet_challenge_required" });
  if (session.status === "ready") return res.status(409).json({ error: "identity_already_verified" });
  if (session.status === "oauth_pending" && session.oauth) return res.status(409).json({ error: "oauth_already_started" });
  const challenge = getChallenge(session.challengeId);
  if (!challenge || challenge.sessionId !== session.id || challenge.wallet !== session.wallet) {
    return res.status(400).json({ error: "wallet_challenge_expired" });
  }
  if (!verifyWalletSignature(challenge.message, req.body?.signature, session.wallet)) {
    return res.status(400).json({ error: "wallet_signature_invalid" });
  }
  challenge.verifiedAt = Date.now();
  const state = randomId(32);
  const codeVerifier = randomId(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  session.status = "oauth_pending";
  session.oauth = { stateHash: hashValue(state), codeVerifier, createdAt: Date.now() };
  const authorize = new URL(identityConfig.xAuthorizeUrl);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", identityConfig.xClientId);
  authorize.searchParams.set("redirect_uri", identityConfig.xRedirectUri);
  authorize.searchParams.set("scope", identityConfig.xScopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return res.json({ status: "oauth_redirect", authorizeUrl: authorize.toString() });
});

router.get("/identity/x/callback", async (req, res) => {
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.status(503).json({ error: "identity_verification_not_configured" });
  }
  const session = sessionFromRequest(req, identityConfig);
  if (!session) return res.status(400).json({ error: "verification_session_missing" });
  if (session.status === "ready") return res.redirect(303, redirectToUi(identityConfig, "success"));
  if (!session.oauth) return res.redirect(303, redirectToUi(identityConfig, "error", "oauth_session_missing"));
  if (session.oauth.usedAt) return res.redirect(303, redirectToUi(identityConfig, "error", session.errorCode ?? "oauth_replay"));
  session.oauth.usedAt = Date.now();
  if (typeof req.query.error === "string") {
    failSession(session, "x_denied");
    return res.redirect(303, redirectToUi(identityConfig, "error", "x_denied"));
  }
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!code || !state || hashValue(state) !== session.oauth.stateHash) {
    failSession(session, "state_invalid");
    return res.redirect(303, redirectToUi(identityConfig, "error", "state_invalid"));
  }
  if (!allowRequest(clientKey(req, "oauth-callback"), RATE_LIMIT, RATE_WINDOW_MS)) {
    failSession(session, "too_many_attempts");
    return res.redirect(303, redirectToUi(identityConfig, "error", "too_many_attempts"));
  }
  try {
    const stableAccountId = await getStableAccountId(identityConfig, await exchangeCode(identityConfig, code, session.oauth.codeVerifier));
    const verifiedProfileHash = profileHash(stableAccountId);
    const contract = new ContractSnapshotProvider(
      process.env.ROBINHOOD_RPC_URL ?? "",
      identityConfig.contractAddress,
    );
    const authorization = await createMintAuthorization(
      identityConfig,
      contract,
      session.wallet!,
      verifiedProfileHash,
      session.challengeId!,
      session.id,
    );
    saveAuthorization(authorization);
    session.profileHash = verifiedProfileHash;
    session.authorizationId = authorization.id;
    session.status = "ready";
    session.errorCode = undefined;
    return res.redirect(303, redirectToUi(identityConfig, "success"));
  } catch (error) {
    failSession(session, safeErrorCode(error));
    return res.redirect(303, redirectToUi(identityConfig, "error", safeErrorCode(error)));
  }
});

router.get("/identity/status", (req, res) => {
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.json({ status: "unavailable" });
  }
  const session = sessionFromRequest(req, identityConfig);
  if (!session) return res.json({ status: "anonymous" });
  const authorization = session.authorizationId ? getAuthorization(session.authorizationId) : undefined;
  return res.json({
    status: session.status,
    walletVerified: Boolean(session.wallet && session.challengeId && getChallenge(session.challengeId)?.verifiedAt),
    xVerified: session.status === "ready",
    mintAuthorizationAvailable: Boolean(authorization && !authorization.consumedAt),
    expiresAt: new Date(session.expiresAt).toISOString(),
    errorCode: session.status === "failed" ? session.errorCode : undefined,
  });
});

router.post("/identity/mint-authorization", (req, res) => {
  if (!allowRequest(clientKey(req, "mint-authorization"), RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ error: "too_many_attempts", retryAfterSeconds: 600 });
  }
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.status(503).json({ error: "identity_verification_not_configured" });
  }
  const session = sessionFromRequest(req, identityConfig);
  const authorization = session?.authorizationId ? getAuthorization(session.authorizationId) : undefined;
  if (!session || session.status !== "ready" || !authorization) return res.status(409).json({ error: "verification_required" });
  if (authorization.consumedAt) return res.status(410).json({ error: "authorization_already_used" });
  authorization.consumedAt = Date.now();
  return res.json({ ...authorization.payload, expiresAt: new Date(authorization.expiresAt).toISOString() });
});

router.post("/identity/reset", (req, res) => {
  let identityConfig: IdentityConfig;
  try {
    identityConfig = config();
  } catch {
    return res.status(204).end();
  }
  res.clearCookie(SESSION_COOKIE, { path: "/api/identity" });
  return res.status(204).end();
});

export default router;