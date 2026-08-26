import { keccak256, toUtf8Bytes } from "ethers";
import type { IdentityConfig } from "./config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringField(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`X response is missing ${name}`);
  return value;
}

async function jsonResponse(response: Response, description: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`${description} returned ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body)) throw new Error(`${description} returned invalid JSON`);
  return body;
}

export async function exchangeCode(config: IdentityConfig, code: string, codeVerifier: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: config.xClientId,
    redirect_uri: config.xRedirectUri,
    code_verifier: codeVerifier,
    client_secret: config.xClientSecret,
  });
  const response = await fetch(config.xTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  const parsed = await jsonResponse(response, "X token exchange");
  return stringField(parsed.access_token, "access_token");
}

export async function getStableAccountId(config: IdentityConfig, accessToken: string): Promise<string> {
  const response = await fetch(config.xUserInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  const parsed = await jsonResponse(response, "X user profile");
  const data = isRecord(parsed.data) ? parsed.data : undefined;
  return stringField(data?.id, "account id");
}

export function profileHash(stableAccountId: string): string {
  return keccak256(toUtf8Bytes(`stonkalicious:x-profile:v1:${stableAccountId}`));
}