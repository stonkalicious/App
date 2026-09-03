import { readFile } from "node:fs/promises";
import { ethers } from "ethers";
import solc from "solc";

const required = [
  "RPC_URL",
  "CONTRACT_ADDRESS",
  "BASE_TOKEN_URI",
  "CONTRACT_URI",
  "SNAPSHOT_ORACLE_PRIVATE_KEY",
  "MINT_SIGNER_PRIVATE_KEY",
  "ROYALTY_RECEIVER",
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required; provide it through the deployment environment's secret manager`);
  }
}

const contractAddress = process.env.CONTRACT_ADDRESS;
if (!ethers.isAddress(contractAddress) || contractAddress === ethers.ZeroAddress) {
  throw new Error("CONTRACT_ADDRESS must be a non-zero EVM address");
}
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== 46630n) {
  throw new Error(`Refusing verification: expected Robinhood Chain testnet chain ID 46630, got ${network.chainId}`);
}
if ((await provider.getCode(contractAddress)) === "0x") {
  throw new Error("CONTRACT_ADDRESS has no deployed bytecode");
}
const oracleAddress = new ethers.Wallet(process.env.SNAPSHOT_ORACLE_PRIVATE_KEY).address;
const mintSignerAddress = new ethers.Wallet(process.env.MINT_SIGNER_PRIVATE_KEY).address;
const deployedConfig = new ethers.Contract(contractAddress, [
  "function baseTokenURI() view returns (string)",
  "function contractURI() view returns (string)",
], provider);
if (await deployedConfig.baseTokenURI() !== process.env.BASE_TOKEN_URI) {
  throw new Error("BASE_TOKEN_URI does not match the deployed contract");
}
if (await deployedConfig.contractURI() !== process.env.CONTRACT_URI) {
  throw new Error("CONTRACT_URI does not match the deployed contract");
}
const source = await readFile(new URL("../src/Stonkalicious.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "Stonkalicious.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const compilerVersion = solc.version().match(/^(\d+\.\d+\.\d+\+commit\.[0-9a-f]+)/)?.[1];
if (!compilerVersion) throw new Error("Unable to determine the Solidity compiler version");

const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const constructorArguments = abiCoder.encode(
  ["uint256", "uint256", "uint256", "string", "address", "address", "address"],
  [
    BigInt(process.env.MAX_SUPPLY ?? "10000"),
    ethers.parseEther(process.env.MINT_PRICE_ETH ?? "0.01"),
    BigInt(process.env.MAX_PER_WALLET ?? "1"),
    process.env.BASE_TOKEN_URI,
    oracleAddress,
    mintSignerAddress,
    process.env.ROYALTY_RECEIVER,
  ],
).slice(2);

const form = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  contractaddress: contractAddress,
  codeformat: "solidity-standard-json-input",
  contractname: "Stonkalicious.sol:Stonkalicious",
  compilerversion: `v${compilerVersion}`,
  optimizationUsed: "1",
  runs: "200",
  evmversion: "paris",
  sourceCode: JSON.stringify(input),
  constructorArguements: constructorArguments,
});
const response = await fetch("https://explorer.testnet.chain.robinhood.com/api", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form,
});
if (!response.ok) throw new Error(`Explorer verification returned HTTP ${response.status}`);
const submission = await response.json();
if (submission.status !== "1" || typeof submission.result !== "string") {
  throw new Error(`Explorer verification was rejected: ${submission.message ?? "unknown error"}`);
}

const guid = submission.result;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const statusResponse = await fetch(
    `https://explorer.testnet.chain.robinhood.com/api?module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}`,
  );
  if (!statusResponse.ok) throw new Error(`Explorer verification status returned HTTP ${statusResponse.status}`);
  const status = await statusResponse.json();
  if (status.result === "Pending in queue") continue;
  if (status.status !== "1" || status.result !== "Pass - Verified") {
    throw new Error(`Explorer verification failed: ${status.result ?? status.message ?? "unknown error"}`);
  }
  console.log(JSON.stringify({
    contract: contractAddress,
    explorer: `https://explorer.testnet.chain.robinhood.com/address/${contractAddress}#code`,
    compiler: `solc ${compilerVersion}`,
    status: "verified",
  }, null, 2));
  process.exit(0);
}
throw new Error("Explorer verification did not finish before the polling deadline");