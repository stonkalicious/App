import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ethers } from "ethers";

const required = [
  "RPC_URL",
  "CONTRACT_ADDRESS",
  "DEPLOYER_PRIVATE_KEY",
  "SNAPSHOT_ORACLE_PRIVATE_KEY",
  "MINT_SIGNER_PRIVATE_KEY",
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required; provide it through the deployment environment's secret manager`);
  }
}

const artifact = JSON.parse(
  await readFile(new URL("../artifacts/Stonkalicious.json", import.meta.url)),
);
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== 46630n) {
  throw new Error(`Refusing rehearsal: expected Robinhood Chain testnet chain ID 46630, got ${network.chainId}`);
}

const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const snapshotOracle = new ethers.Wallet(process.env.SNAPSHOT_ORACLE_PRIVATE_KEY, provider);
const mintSigner = new ethers.Wallet(process.env.MINT_SIGNER_PRIVATE_KEY, provider);
const contractAddress = process.env.CONTRACT_ADDRESS;
if (!ethers.isAddress(contractAddress) || contractAddress === ethers.ZeroAddress) {
  throw new Error("CONTRACT_ADDRESS must be a non-zero EVM address");
}
const code = await provider.getCode(contractAddress);
if (code === "0x") throw new Error("CONTRACT_ADDRESS has no deployed bytecode");

const contract = new ethers.Contract(contractAddress, artifact.abi, deployer);
const deployedDeployer = await contract.owner();
const deployedOracle = await contract.snapshotOracle();
const deployedMintSigner = await contract.mintSigner();
assert.equal(deployedDeployer.toLowerCase(), deployer.address.toLowerCase(), "owner/deployer mismatch");
assert.equal(deployedOracle.toLowerCase(), snapshotOracle.address.toLowerCase(), "snapshot oracle mismatch");
assert.equal(deployedMintSigner.toLowerCase(), mintSigner.address.toLowerCase(), "mint signer mismatch");
assert.notEqual(deployer.address.toLowerCase(), snapshotOracle.address.toLowerCase(), "deployer and oracle must differ");
assert.notEqual(deployer.address.toLowerCase(), mintSigner.address.toLowerCase(), "deployer and mint signer must differ");
assert.notEqual(snapshotOracle.address.toLowerCase(), mintSigner.address.toLowerCase(), "oracle and mint signer must differ");
const minimumOracleBalance = ethers.parseEther("0.005");
if ((await provider.getBalance(snapshotOracle.address)) < minimumOracleBalance) {
  throw new Error("snapshot oracle needs at least 0.005 testnet ETH for the rehearsal");
}

const expectedMaxSupply = BigInt(process.env.EXPECTED_MAX_SUPPLY ?? "10000");
const expectedMintPrice = ethers.parseEther(process.env.EXPECTED_MINT_PRICE_ETH ?? "0.01");
if ((await provider.getBalance(deployer.address)) < expectedMintPrice) {
  throw new Error("deployer needs enough testnet ETH for the paid rehearsal mint");
}
assert.equal(await contract.maxSupply(), expectedMaxSupply, "maxSupply mismatch");
assert.equal(await contract.mintPrice(), expectedMintPrice, "mintPrice mismatch");
assert.equal(await contract.maxPerWallet(), 1n, "maxPerWallet must remain one");
if (process.env.EXPECTED_BASE_TOKEN_URI) {
  assert.equal(await contract.baseTokenURI(), process.env.EXPECTED_BASE_TOKEN_URI, "base token URI mismatch");
}
if (process.env.EXPECTED_CONTRACT_URI) {
  assert.equal(await contract.contractURI(), process.env.EXPECTED_CONTRACT_URI, "contract URI mismatch");
}

const chainId = network.chainId;
const domain = {
  name: "Stonkalicious",
  version: "1",
  chainId,
  verifyingContract: contractAddress,
};
const types = {
  Mint: [
    { name: "wallet", type: "address" },
    { name: "quantity", type: "uint256" },
    { name: "profileHash", type: "bytes32" },
    { name: "challengeId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const nonceBase = BigInt(process.env.REHEARSAL_NONCE ?? Math.floor(Date.now() / 1000));
const challengeId = ethers.keccak256(ethers.toUtf8Bytes("stonkalicious-private-testnet-rehearsal"));
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
const primaryProfile = ethers.keccak256(ethers.toUtf8Bytes(`rehearsal-primary-${nonceBase}`));
const secondaryProfile = ethers.keccak256(ethers.toUtf8Bytes(`rehearsal-secondary-${nonceBase}`));

async function signedMint(wallet, profileHash, nonce) {
  const value = {
    wallet: wallet.address,
    quantity: 1,
    profileHash,
    challengeId,
    nonce,
    deadline,
  };
  return { value, signature: await mintSigner.signTypedData(domain, types, value) };
}

async function expectRevert(label, operation) {
  try {
    await operation();
  } catch {
    console.log(`PASS ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

const primaryMint = await signedMint(deployer, primaryProfile, nonceBase);
await (await contract.mint(
  1,
  primaryProfile,
  challengeId,
  nonceBase,
  deadline,
  primaryMint.signature,
  { value: expectedMintPrice },
)).wait();
assert.equal(await contract.mintedByWallet(deployer.address), 1n, "primary wallet mint ledger mismatch");
assert.equal(await contract.warriorByXProfile(primaryProfile), 1n, "primary identity binding missing");
console.log("PASS mint authorization and first identity binding");

await expectRevert("one-wallet lifetime limit", async () => {
  const secondMint = await signedMint(deployer, secondaryProfile, nonceBase + 1n);
  await (await contract.mint(
    1,
    secondaryProfile,
    challengeId,
    nonceBase + 1n,
    deadline,
    secondMint.signature,
    { value: expectedMintPrice },
  )).wait();
});

await expectRevert("identity uniqueness", async () => {
  const duplicateIdentity = await signedMint(snapshotOracle, primaryProfile, nonceBase + 2n);
  await (await contract.connect(snapshotOracle).mint(
    1,
    primaryProfile,
    challengeId,
    nonceBase + 2n,
    deadline,
    duplicateIdentity.signature,
    { value: expectedMintPrice },
  )).wait();
});

const snapshotValue = 100_000n;
await (await contract.connect(snapshotOracle).recordStartingBagValue(1, snapshotValue)).wait();
const snapshot = await contract.snapshotOf(1);
assert.equal(snapshot.wallet.toLowerCase(), deployer.address.toLowerCase(), "snapshot wallet mismatch");
assert.equal(snapshot.startingBagValue, snapshotValue, "snapshot value mismatch");
console.log("PASS snapshot oracle write");

await expectRevert("seven-day transfer lock", async () => {
  await (await contract.transferFrom(deployer.address, snapshotOracle.address, 1)).wait();
});

await (await contract.setPaused(true)).wait();
await expectRevert("pause blocks oracle writes", async () => {
  await (await contract.connect(snapshotOracle).recordStartingBagValue(1, snapshotValue + 1n)).wait();
});
await (await contract.setPaused(false)).wait();
assert.equal(await contract.paused(), false, "pause recovery failed");
console.log("PASS pause recovery");

const originalBaseURI = await contract.baseTokenURI();
const rehearsalBaseURI = "https://stonkalicious.com/api/token/rehearsal/";
await (await contract.setBaseTokenURI(rehearsalBaseURI)).wait();
assert.equal(await contract.tokenURI(1), `${rehearsalBaseURI}1`, "metadata base URI update failed");
await (await contract.setBaseTokenURI(originalBaseURI)).wait();
assert.equal(await contract.tokenURI(1), `${originalBaseURI}1`, "metadata base URI restore failed");
console.log("PASS metadata URI update and restore");

console.log(JSON.stringify({
  network: chainId.toString(),
  contract: contractAddress,
  deployer: deployer.address,
  snapshotOracle: snapshotOracle.address,
  mintSigner: mintSigner.address,
  tokenId: "1",
  transferReset: "blocked until seven-day lock expires; rerun transfer phase after unlock",
}, null, 2));