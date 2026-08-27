import { readFile } from "node:fs/promises";
import { ethers } from "ethers";

const required = ["RPC_URL", "DEPLOYER_PRIVATE_KEY", "SNAPSHOT_ORACLE", "MINT_SIGNER"];
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
const network = await provider.getNetwork();
if (network.chainId !== 46630n) {
  throw new Error(`Refusing deployment: expected Robinhood Chain testnet chain ID 46630, got ${network.chainId}`);
}

const roleAddresses = {
  deployer: deployer.address,
  snapshotOracle: process.env.SNAPSHOT_ORACLE,
  mintSigner: process.env.MINT_SIGNER,
};
for (const [role, address] of Object.entries(roleAddresses)) {
  if (!ethers.isAddress(address) || address === ethers.ZeroAddress) {
    throw new Error(`${role} must be a non-zero EVM address`);
  }
}
const uniqueRoles = new Set(Object.values(roleAddresses).map((address) => address.toLowerCase()));
if (uniqueRoles.size !== Object.keys(roleAddresses).length) {
  throw new Error("deployer, snapshotOracle, and mintSigner must be separate addresses");
}

const maxSupply = BigInt(process.env.MAX_SUPPLY ?? "10000");
const mintPrice = ethers.parseEther(process.env.MINT_PRICE_ETH ?? "0.01");
const maxPerWallet = BigInt(process.env.MAX_PER_WALLET ?? "1");
const baseTokenURI = process.env.BASE_TOKEN_URI;
if (!baseTokenURI) throw new Error("BASE_TOKEN_URI is required");
const contractURI = process.env.CONTRACT_URI;
if (!contractURI) throw new Error("CONTRACT_URI is required");

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
const contract = await factory.deploy(
  maxSupply,
  mintPrice,
  maxPerWallet,
  baseTokenURI,
  process.env.SNAPSHOT_ORACLE,
  process.env.MINT_SIGNER,
);
await contract.waitForDeployment();
await (await contract.setContractURI(contractURI)).wait();

console.log(JSON.stringify({
  network: network.chainId.toString(),
  explorer: "https://explorer.testnet.chain.robinhood.com",
  deployer: deployer.address,
  contract: await contract.getAddress(),
  maxSupply: maxSupply.toString(),
  mintPriceWei: mintPrice.toString(),
  maxPerWallet: maxPerWallet.toString(),
  baseTokenURI,
  contractURI,
  snapshotOracle: process.env.SNAPSHOT_ORACLE,
  mintSigner: process.env.MINT_SIGNER,
  snapshotWriteInterface: "recordStartingBagValue(tokenId, expectedEpoch, startingBagValue)",
}, null, 2));