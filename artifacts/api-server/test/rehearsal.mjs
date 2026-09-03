import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";

const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";
const assetContract = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const contractAddress = `0x${"b".repeat(40)}`;
const royaltyReceiver = "0x3333333333333333333333333333333333333333";

let assetMode = "fresh";
let snapshotEpoch = 1;
let snapshotWriteEpoch = 1;

function abiWord(value) {
  return value.toString(16).padStart(64, "0");
}

function addressWord(address) {
  return address.slice(2).padStart(64, "0");
}

const mockServer = createServer(async (request, response) => {
  if (request.url?.startsWith("/rpc")) {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpcRequest = JSON.parse(body);
    const callData = rpcRequest.params?.[0]?.data ?? "";
    const result = callData.startsWith("0x6352211e")
      ? `0x${addressWord(wallet)}`
      : callData.startsWith("0x1042c951")
        ? `0x${abiWord(snapshotWriteEpoch)}`
        : `0x${addressWord(wallet)}${abiWord(1_700_000_000)}${abiWord(snapshotEpoch)}${abiWord(100)}`;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpcRequest.id, result }));
    return;
  }

  if (request.url?.startsWith("/assets/")) {
    response.setHeader("content-type", "application/json");
    if (assetMode === "outage") {
      response.writeHead(503);
      response.end(JSON.stringify({ error: "provider outage" }));
      return;
    }
    if (assetMode === "invalid-wallet") {
      response.writeHead(200);
      response.end(JSON.stringify({ wallet: otherWallet, currentValueUsd: 150, assets: [] }));
      return;
    }
    if (assetMode === "invalid-asset") {
      response.writeHead(200);
      response.end(JSON.stringify({ wallet, currentValueUsd: 150, assets: [null] }));
      return;
    }
    if (assetMode === "invalid-provider") {
      response.writeHead(200);
      response.end(JSON.stringify({ wallet, currentValueUsd: "not-a-number", assets: [] }));
      return;
    }
    response.writeHead(200);
    response.end(JSON.stringify({
      wallet,
      currentValueUsd: 150,
      highWaterMarkUsd: 160,
      lowWaterMarkUsd: 100,
      maxDrawdownPct: 6.25,
      recoveredFromDrawdown: false,
      observedAt: "2026-08-26T12:00:00.000Z",
      assets: [{ symbol: "RH", kind: "coin", contractAddress: assetContract, valueUsd: 150 }],
    }));
    return;
  }

  response.writeHead(404);
  response.end();
});

await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
const mockPort = mockServer.address().port;
const rpcUrl = `http://127.0.0.1:${mockPort}/rpc`;
const assetUrl = `http://127.0.0.1:${mockPort}/assets`;

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startApi(metadataPublic) {
  const port = await freePort();
  const child = spawn("node", ["--enable-source-maps", "dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      METADATA_BASE_URL: "https://metadata.example",
      ROBINHOOD_RPC_URL: rpcUrl,
      STONKALICIOUS_CONTRACT_ADDRESS: contractAddress,
      PUBLIC_ASSET_DATA_URL: assetUrl,
      ROBINHOOD_ASSET_ALLOWLIST_JSON: JSON.stringify([{
        symbol: "RH",
        contractAddress: assetContract,
        kind: "coin",
        decimals: 18,
      }]),
      ORACLE_CACHE_TTL_MS: "50",
      ORACLE_STALE_TTL_MS: "150",
      METADATA_PUBLIC: metadataPublic ? "true" : "false",
      ROYALTY_RECEIVER: royaltyReceiver,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/healthz`);
      if (health.ok) return { child, port, logs };
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  child.kill("SIGTERM");
  throw new Error(`API server did not start:\n${logs.join("")}`);
}

async function stopApi(api) {
  api.child.kill("SIGTERM");
  await once(api.child, "exit");
}

try {
  const lockedApi = await startApi(false);
  const lockedResponse = await fetch(`http://127.0.0.1:${lockedApi.port}/api/token/1`);
  assert.equal(lockedResponse.status, 404, "metadata stays locked before release");
  assert.deepEqual(await lockedResponse.json(), { error: "metadata is not public" });
  await stopApi(lockedApi);

  const api = await startApi(true);
  const metadataUrl = (tokenId) => `http://127.0.0.1:${api.port}/api/token/${tokenId}`;
   const collectionResponse = await fetch(`http://127.0.0.1:${api.port}/api/collection`);
   assert.equal(collectionResponse.status, 503, "collection metadata stays blocked while God artwork is unavailable");
   const blockedCollection = await collectionResponse.json();
   assert.equal(blockedCollection.level, "God");
   assert.match(blockedCollection.blocker, /distinct God artwork is missing/);

  snapshotWriteEpoch = 0;
  const pendingResponse = await fetch(metadataUrl(1));
  assert.equal(pendingResponse.status, 503, "metadata is unavailable before the baseline is recorded");
  snapshotWriteEpoch = 1;
  assetMode = "fresh";
  const freshResponse = await fetch(metadataUrl(1));
  assert.equal(freshResponse.status, 200, "fresh metadata is served");
  const fresh = await freshResponse.json();
  assert.equal(fresh.properties.stale, false);
   assert.equal(fresh.attributes.find((attribute) => attribute.trait_type === "Eligible coin value (USD)").value, 150);
  assert.equal(fresh.attributes.find((attribute) => attribute.trait_type === "Data status").value, "fresh");

  snapshotEpoch = 2;
  snapshotWriteEpoch = 2;
  const newEpochResponse = await fetch(metadataUrl(1));
  assert.equal(newEpochResponse.status, 200, "new snapshot epoch bypasses prior cache");
  const newEpoch = await newEpochResponse.json();
  assert.equal(newEpoch.properties.epoch, "2");

  assetMode = "outage";
  await new Promise((resolve) => setTimeout(resolve, 70));
  const staleResponse = await fetch(metadataUrl(1));
  assert.equal(staleResponse.status, 200, "stale metadata is served during a provider outage");
  const stale = await staleResponse.json();
  assert.equal(stale.properties.stale, true);
  assert.equal(stale.attributes.find((attribute) => attribute.trait_type === "Data status").value, "stale");

  await new Promise((resolve) => setTimeout(resolve, 100));
  const expiredResponse = await fetch(metadataUrl(1));
  assert.equal(expiredResponse.status, 503, "expired stale data is not served");
  assert.deepEqual(await expiredResponse.json(), { error: "NFT data is temporarily unavailable" });

  for (const [mode, tokenId] of [["invalid-wallet", 2], ["invalid-asset", 3], ["invalid-provider", 4]]) {
    assetMode = mode;
    const invalidResponse = await fetch(metadataUrl(tokenId));
    assert.equal(invalidResponse.status, 503, `${mode} is rejected`);
  }

  await stopApi(api);
  console.log("API rehearsal passed: pending baseline, fresh, stale, expired, locked, and invalid data paths.");
} finally {
  mockServer.close();
}