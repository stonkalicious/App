import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";

const wallet = "0x1111111111111111111111111111111111111111";
const stockAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const cryptoAddress = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const stableAddress = "0xcccccccccccccccccccccccccccccccccccccc";
const otherChainAddress = "0xdddddddddddddddddddddddddddddddddddddd";
const chainId = "0x1237";

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function abiWord(value) {
  return value.toString(16).padStart(64, "0");
}

function balance(value) {
  return `0x${abiWord(BigInt(value) * 10n ** 18n)}`;
}

const mockServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/registry") {
    return json(response, 200, {
      assets: [
        {
          tokenSymbol: "AAPL",
          tokenName: "Apple • Robinhood Token",
          status: "ASSET_STATUS_ACTIVE",
          tokenDecimals: 18,
          currentMultiplier: "1",
          deployments: [{ chainId: 4663, contractAddress: stockAddress }],
        },
        {
          tokenSymbol: "WETH",
          tokenName: "Wrapped Ether",
          status: "ASSET_STATUS_ACTIVE",
          tokenDecimals: 18,
          deployments: [{ chainId: 4663, contractAddress: stableAddress }],
        },
        {
          tokenSymbol: "USDC",
          tokenName: "USD Coin",
          status: "ASSET_STATUS_ACTIVE",
          tokenDecimals: 6,
          deployments: [{ chainId: 4663, contractAddress: stableAddress }],
        },
        {
          tokenSymbol: "SKIP",
          tokenName: "Other Chain • Robinhood Token",
          status: "ASSET_STATUS_ACTIVE",
          tokenDecimals: 18,
          deployments: [{ chainId: 46630, contractAddress: otherChainAddress }],
        },
      ],
    });
  }
  if (url.pathname === "/crypto") {
    const symbol = url.searchParams.get("q");
    if (symbol === "VIRTUAL") {
      return json(response, 200, {
        pairs: [{
          chainId: "robinhood",
          baseToken: { symbol: "VIRTUAL", name: "Virtuals Protocol", address: cryptoAddress },
          marketCap: 6000000,
          priceUsd: "2",
        }],
      });
    }
    return json(response, 200, {
      pairs: [{
        chainId: "robinhood",
        baseToken: { symbol, name: "Too Small", address: otherChainAddress },
        marketCap: 4999999,
        priceUsd: "1",
      }],
    });
  }
  if (url.pathname === "/prices/AAPL") {
    return json(response, 200, {
      quotes: [{
        tokenSymbol: "AAPL",
        bid: "100",
        ask: "102",
        currency: "USD",
        generatedAt: new Date().toISOString(),
      }],
    });
  }
  if (url.pathname === "/rpc") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    if (rpc.method === "eth_chainId") return json(response, 200, { jsonrpc: "2.0", id: rpc.id, result: chainId });
    if (rpc.method === "eth_getCode") return json(response, 200, { jsonrpc: "2.0", id: rpc.id, result: "0x60006000" });
    if (rpc.method === "eth_call") {
      const to = rpc.params?.[0]?.to?.toLowerCase();
      const value = to === stockAddress ? 2 : to === cryptoAddress ? 3 : 0;
      return json(response, 200, { jsonrpc: "2.0", id: rpc.id, result: balance(value) });
    }
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
const port = mockServer.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const free = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return free;
}

const apiPort = await freePort();
const api = spawn("node", ["--enable-source-maps", "dist/index.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(apiPort),
    METADATA_BASE_URL: "https://metadata.example",
    ROBINHOOD_RPC_URL: `${baseUrl}/rpc`,
    ROBINHOOD_ASSET_RPC_URL: `${baseUrl}/rpc`,
    ROBINHOOD_ASSET_CHAIN_ID: "4663",
    ROBINHOOD_ASSET_REGISTRY_URL: `${baseUrl}/registry`,
    ROBINHOOD_CRYPTO_REGISTRY_URL: `${baseUrl}/crypto`,
    ROBINHOOD_CRYPTO_SYMBOLS: "VIRTUAL,SMALL",
    ROBINHOOD_CRYPTO_MARKET_CAP_FLOOR_USD: "5000000",
    ROBINHOOD_PRICE_URL: `${baseUrl}/prices`,
    STONKALICIOUS_CONTRACT_ADDRESS: `0x${"e".repeat(40)}`,
    ROYALTY_RECEIVER: `0x${"f".repeat(40)}`,
    PUBLIC_ASSET_DATA_URL: `${baseUrl}/unused`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${apiPort}/api/healthz`)).ok) break;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const result = await fetch(`http://127.0.0.1:${apiPort}/api/assets/${wallet}`);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.currentValueUsd, 208);
  assert.deepEqual(body.assets.map((asset) => asset.symbol), ["AAPL", "VIRTUAL"]);
  assert.deepEqual(body.assets.map((asset) => asset.kind), ["stock", "crypto"]);
  assert.equal(body.assets[0].valueUsd, 202);
  assert.equal(body.assets[1].valueUsd, 6);
  assert.equal(body.assets.some((asset) => asset.symbol === "WETH"), false);
  assert.equal(body.assets.some((asset) => asset.symbol === "SMALL"), false);
  console.log("Dynamic registry rehearsal passed: official stock filtering, native crypto threshold, and pricing.");
} finally {
  api.kill("SIGTERM");
  await once(api, "exit");
  mockServer.close();
}