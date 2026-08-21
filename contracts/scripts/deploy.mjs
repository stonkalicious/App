import { readFile } from "node:fs/promises";
import { ethers } from "ethers";

const required = ["RPC_URL", "DEPLOYER_PRIVATE_KEY", "SNAPSHOT_ORACLE"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required; provide it through the deployment environment's secret manager`);
  }
}

const artifact = JSON.parse(
  await readFile(new URL("../artifacts/Stonkalicious.json", import.meta.url)),
);
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const maxSupply = BigInt(process.env.MAX_SUPPLY ?? "10000");
const mintPrice = ethers.parseEther(process.env.MINT_PRICE_ETH ?? "0.01");
const maxPerWallet = BigInt(process.env.MAX_PER_WALLET ?? "3");
const baseTokenURI = process.env.BASE_TOKEN_URI;
if (!baseTokenURI) throw new Error("BASE_TOKEN_URI is required");

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
const contract = await factory.deploy(
  maxSupply,
  mintPrice,
  maxPerWallet,
  baseTokenURI,
  process.env.SNAPSHOT_ORACLE,
);
await contract.waitForDeployment();

console.log(JSON.stringify({
  network: (await provider.getNetwork()).chainId.toString(),
  deployer: deployer.address,
  contract: await contract.getAddress(),
  maxSupply: maxSupply.toString(),
  mintPriceWei: mintPrice.toString(),
  maxPerWallet: maxPerWallet.toString(),
  baseTokenURI,
  snapshotOracle: process.env.SNAPSHOT_ORACLE,
}, null, 2));