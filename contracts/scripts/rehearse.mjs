import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ethers } from "ethers";

const phase = process.env.REHEARSAL_PHASE ?? "full";
if (phase !== "full" && phase !== "post-unlock") {
  throw new Error("REHEARSAL_PHASE must be either full or post-unlock");
}

const required = ["RPC_URL", "CONTRACT_ADDRESS", "DEPLOYER_PRIVATE_KEY"];
if (phase === "full") {
  required.push("SNAPSHOT_ORACLE_PRIVATE_KEY", "MINT_SIGNER_PRIVATE_KEY");
}
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
const snapshotOracleSigner = process.env.SNAPSHOT_ORACLE_PRIVATE_KEY
  ? new ethers.Wallet(process.env.SNAPSHOT_ORACLE_PRIVATE_KEY, provider)
  : undefined;
const mintSigner = process.env.MINT_SIGNER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.MINT_SIGNER_PRIVATE_KEY, provider)
  : undefined;
const configuredContractAddress = process.env.CONTRACT_ADDRESS;
if (!/^0x[a-fA-F0-9]{40}$/.test(configuredContractAddress ?? "")) {
  throw new Error("CONTRACT_ADDRESS must be a non-zero EVM address");
}
const contractAddress = ethers.getAddress(configuredContractAddress.toLowerCase());
if (contractAddress === ethers.ZeroAddress) {
  throw new Error("CONTRACT_ADDRESS must be a non-zero EVM address");
}
const code = await provider.getCode(contractAddress);
if (code === "0x") throw new Error("CONTRACT_ADDRESS has no deployed bytecode");

const contract = new ethers.Contract(contractAddress, artifact.abi, deployer);
const deployedDeployer = await contract.owner();
const snapshotOracleAddress = await contract.snapshotOracle();
const deployedMintSigner = await contract.mintSigner();
assert.equal(deployedDeployer.toLowerCase(), deployer.address.toLowerCase(), "owner/deployer mismatch");
assert.notEqual(deployer.address.toLowerCase(), snapshotOracleAddress.toLowerCase(), "deployer and oracle must differ");
assert.notEqual(deployer.address.toLowerCase(), deployedMintSigner.toLowerCase(), "deployer and mint signer must differ");
assert.notEqual(snapshotOracleAddress.toLowerCase(), deployedMintSigner.toLowerCase(), "oracle and mint signer must differ");
if (phase === "full") {
  assert.equal(snapshotOracleAddress.toLowerCase(), snapshotOracleSigner.address.toLowerCase(), "snapshot oracle mismatch");
  assert.equal(deployedMintSigner.toLowerCase(), mintSigner.address.toLowerCase(), "mint signer mismatch");
  const minimumOracleBalance = ethers.parseEther("0.005");
  if ((await provider.getBalance(snapshotOracleSigner.address)) < minimumOracleBalance) {
    throw new Error("snapshot oracle needs at least 0.005 testnet ETH for the rehearsal");
  }
}

const expectedMaxSupply = BigInt(process.env.EXPECTED_MAX_SUPPLY ?? "10000");
const expectedMintPrice = ethers.parseEther(process.env.EXPECTED_MINT_PRICE_ETH ?? "0.01");
if (phase === "full") {
  if ((await provider.getBalance(deployer.address)) < expectedMintPrice) {
    throw new Error("deployer needs enough testnet ETH for the paid rehearsal mint");
  }
  assert.equal(await contract.maxSupply(), expectedMaxSupply, "maxSupply mismatch");
  assert.equal(await contract.mintPrice(), expectedMintPrice, "mintPrice mismatch");
  assert.equal(await contract.maxPerWallet(), 1n, "maxPerWallet must remain one");
}
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

async function assertMetadataLocked() {
  const tokenUrl = await contract.tokenURI(BigInt(process.env.TOKEN_ID ?? "1"));
  const collectionUrl = await contract.contractURI();
  for (const [label, url] of [["token metadata", tokenUrl], ["collection metadata", collectionUrl]]) {
    const response = await fetch(url, { cache: "no-store", redirect: "manual" });
    if (response.status >= 200 && response.status < 300) {
      throw new Error(`${label} became publicly available during the rehearsal`);
    }
    console.log(`PASS ${label} remains unavailable (HTTP ${response.status})`);
  }
}

if (phase === "post-unlock") {
  const tokenId = BigInt(process.env.TOKEN_ID ?? "1");
  const [block, paused, tokenOwner, transferableAfter, initialSnapshot, previousProfile] =
    await Promise.all([
      provider.getBlock("latest"),
      contract.paused(),
      contract.ownerOf(tokenId),
      contract.transferableAfter(tokenId),
      contract.snapshotOf(tokenId),
      contract.xProfileOf(tokenId),
    ]);
  assert.equal(paused, false, "contract must remain unpaused");
  assert.equal(tokenOwner.toLowerCase(), deployer.address.toLowerCase(), "token is not owned by the deployer");
  assert.equal(initialSnapshot.wallet.toLowerCase(), deployer.address.toLowerCase(), "snapshot wallet mismatch before transfer");
  assert.ok(initialSnapshot.startingBagValue > 0n, "a non-zero pre-transfer snapshot is required to verify reset");
  assert.notEqual(previousProfile, ethers.ZeroHash, "a bound X identity is required to verify unbinding");
  assert.equal(await contract.warriorByXProfile(previousProfile), tokenId, "previous X identity is not bound to this token");
  assert.ok(BigInt(block.timestamp) >= transferableAfter, "seven-day transfer lock has not expired");

  const originalBaseURI = await contract.baseTokenURI();
  const originalContractURI = await contract.contractURI();
  await assertMetadataLocked();
  console.log("PASS post-unlock preconditions, ownership, identity binding, and pause state");

  const transfer = await contract.transferFrom(deployer.address, snapshotOracleAddress, tokenId);
  const receipt = await transfer.wait();
  assert.equal(receipt.status, 1, "post-unlock transfer transaction failed");
  console.log(`PASS transfer after unlock (${transfer.hash})`);

  const [afterBlock, afterPaused, newOwner, resetSnapshot, newProfile, previousProfileToken] =
    await Promise.all([
      provider.getBlock(receipt.blockNumber),
      contract.paused(),
      contract.ownerOf(tokenId),
      contract.snapshotOf(tokenId),
      contract.xProfileOf(tokenId),
      contract.warriorByXProfile(previousProfile),
    ]);
  assert.equal(afterPaused, false, "contract became paused during the transfer check");
  assert.equal(newOwner.toLowerCase(), snapshotOracleAddress.toLowerCase(), "token owner did not change to the snapshot oracle");
  assert.equal(resetSnapshot.wallet.toLowerCase(), snapshotOracleAddress.toLowerCase(), "snapshot wallet was not reset");
  assert.equal(resetSnapshot.startingBagValue, 0n, "starting snapshot value was not reset to zero");
  assert.equal(resetSnapshot.epoch, initialSnapshot.epoch + 1n, "snapshot epoch did not increment exactly once");
  assert.equal(newProfile, ethers.ZeroHash, "previous X identity remains bound to the token");
  assert.equal(previousProfileToken, 0n, "previous X identity remains reserved");
  assert.equal(await contract.baseTokenURI(), originalBaseURI, "metadata base URI changed during transfer");
  assert.equal(await contract.contractURI(), originalContractURI, "collection URI changed during transfer");
  await assertMetadataLocked();

  // A non-mutating call proves the released identity may be rebound to this
  // token through the configured verifier, while the mapping remains clear.
  await contract.connect(new ethers.VoidSigner(snapshotOracleAddress, provider))
    .bindXProfile.staticCall(tokenId, previousProfile);
  assert.ok(BigInt(afterBlock.timestamp) >= transferableAfter, "transfer receipt predates the unlock time");
  console.log("PASS previous X identity is reusable through the configured verifier");
  console.log("PASS snapshot wallet reset, starting value zeroed, and epoch incremented");
  console.log(JSON.stringify({
    network: chainId.toString(),
    contract: contractAddress,
    tokenId: tokenId.toString(),
    transfer: transfer.hash,
    previousOwner: deployer.address,
    newOwner: snapshotOracleAddress,
    previousEpoch: initialSnapshot.epoch.toString(),
    newEpoch: resetSnapshot.epoch.toString(),
    startingBagValue: resetSnapshot.startingBagValue.toString(),
    paused: afterPaused,
    metadata: "unavailable",
  }, null, 2));
  process.exit(0);
}

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
  const duplicateIdentity = await signedMint(snapshotOracleSigner, primaryProfile, nonceBase + 2n);
  await (await contract.connect(snapshotOracleSigner).mint(
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
await (await contract.connect(snapshotOracleSigner).recordStartingBagValue(1, snapshotValue)).wait();
const snapshot = await contract.snapshotOf(1);
assert.equal(snapshot.wallet.toLowerCase(), deployer.address.toLowerCase(), "snapshot wallet mismatch");
assert.equal(snapshot.startingBagValue, snapshotValue, "snapshot value mismatch");
console.log("PASS snapshot oracle write");

await expectRevert("seven-day transfer lock", async () => {
  await (await contract.transferFrom(deployer.address, snapshotOracleSigner.address, 1)).wait();
});

await (await contract.setPaused(true)).wait();
await expectRevert("pause blocks oracle writes", async () => {
  await (await contract.connect(snapshotOracleSigner).recordStartingBagValue(1, snapshotValue + 1n)).wait();
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
  snapshotOracle: snapshotOracleSigner.address,
  mintSigner: mintSigner.address,
  tokenId: "1",
  transferReset: "deferred; run REHEARSAL_PHASE=post-unlock after lock expiry",
}, null, 2));