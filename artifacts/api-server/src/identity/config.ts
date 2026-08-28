function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for identity verification`);
  return value;
}

function url(name: string, value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error(`${name} must use HTTPS in production`);
    }
    return parsed.toString();
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function positiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export type IdentityConfig = {
  sessionSecret: string;
  xClientId: string;
  xClientSecret: string;
  xRedirectUri: string;
  xAuthorizeUrl: string;
  xTokenUrl: string;
  xUserInfoUrl: string;
  xScopes: string;
  xConfigured: boolean;
  appBaseUrl: string;
  contractAddress: string;
  mintSignerPrivateKey: string;
  mintPriceWei: string;
  sessionTtlMs: number;
  challengeTtlMs: number;
  authorizationTtlMs: number;
};

export function getIdentityConfig(): IdentityConfig {
  const sessionTtlMs = positiveInteger("IDENTITY_SESSION_TTL_MS", process.env.IDENTITY_SESSION_TTL_MS ?? "900000");
  const challengeTtlMs = positiveInteger("IDENTITY_CHALLENGE_TTL_MS", process.env.IDENTITY_CHALLENGE_TTL_MS ?? "300000");
  const authorizationTtlMs = positiveInteger("IDENTITY_AUTHORIZATION_TTL_MS", process.env.IDENTITY_AUTHORIZATION_TTL_MS ?? "600000");
  if (challengeTtlMs > sessionTtlMs || authorizationTtlMs > sessionTtlMs) {
    throw new Error("Identity challenge and authorization lifetimes must fit inside the session lifetime");
  }

  const contractAddress = required("STONKALICIOUS_CONTRACT_ADDRESS");
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) throw new Error("STONKALICIOUS_CONTRACT_ADDRESS is invalid");

  const mintPriceWei = required("MINT_PRICE_WEI");
  if (!/^(0|[1-9]\d*)$/.test(mintPriceWei)) throw new Error("MINT_PRICE_WEI must be an unsigned integer");

  const xClientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const xClientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
  const xRedirectUriValue = process.env.X_REDIRECT_URI?.trim() ?? "";
  const xConfigured = Boolean(xClientId || xClientSecret || xRedirectUriValue);
  if (xConfigured && (!xClientId || !xClientSecret || !xRedirectUriValue)) {
    throw new Error("X OAuth configuration is incomplete");
  }
  const xScopes = (process.env.X_OAUTH_SCOPES ?? "users.read").trim();
  if (xConfigured && !xScopes.split(/\s+/).includes("users.read")) throw new Error("X_OAUTH_SCOPES must include users.read");

  return {
    sessionSecret: required("SESSION_SECRET"),
    xClientId,
    xClientSecret,
    xRedirectUri: xConfigured ? url("X_REDIRECT_URI", xRedirectUriValue) : "",
    xAuthorizeUrl: url("X_AUTHORIZE_URL", process.env.X_AUTHORIZE_URL ?? "https://twitter.com/i/oauth2/authorize"),
    xTokenUrl: url("X_TOKEN_URL", process.env.X_TOKEN_URL ?? "https://api.x.com/2/oauth2/token"),
    xUserInfoUrl: url("X_USERINFO_URL", process.env.X_USERINFO_URL ?? "https://api.x.com/2/users/me"),
    xScopes,
    xConfigured,
    appBaseUrl: url("IDENTITY_APP_BASE_URL", required("IDENTITY_APP_BASE_URL")),
    contractAddress,
    mintSignerPrivateKey: required("MINT_SIGNER_PRIVATE_KEY"),
    mintPriceWei,
    sessionTtlMs,
    challengeTtlMs,
    authorizationTtlMs,
  };
}