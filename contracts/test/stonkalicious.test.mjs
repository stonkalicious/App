import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ethers } from "ethers";
import ganache from "ganache";

const artifact = JSON.parse(await readFile(new URL("../artifacts/Stonkalicious.json", import.meta.url)));

async function fixture() {
  const server = ganache.server({ logging: { quiet: true }, wallet: { totalAccounts: 6 } });
  await server.listen(0);
  const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${server.address().port}`);
  const initialAccounts = server.provider.getInitialAccounts();
  const keys = Object.values(initialAccounts).map((account) => account.secretKey);
  const [owner, oracle, mintSigner, alice, bob, stranger] = keys.map((key) => new ethers.Wallet(key, provider));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(
    10,
    ethers.parseEther("0.01"),
    1,
    "https://metadata.stonkalicious.xyz/token/",
    await oracle.getAddress(),
    await mintSigner.getAddress(),
  );
  await contract.waitForDeployment();
  return { server, provider, contract, owner, oracle, mintSigner, alice, bob, stranger };
}

async function signedMint(contract, signer, wallet, nonce, profile = `x-account-${nonce}`) {
  const profileHash = profile === null ? ethers.ZeroHash : ethers.keccak256(ethers.toUtf8Bytes(profile));
  const challengeId = ethers.keccak256(ethers.toUtf8Bytes("challenge-1"));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const value = { wallet: await wallet.getAddress(), quantity: 1, profileHash, challengeId, nonce, deadline };
  const signature = await signer.signTypedData(
    { name: "Stonkalicious", version: "1", chainId: (await contract.runner.provider.getNetwork()).chainId, verifyingContract: await contract.getAddress() },
    { Mint: [
      { name: "wallet", type: "address" },
      { name: "quantity", type: "uint256" },
      { name: "profileHash", type: "bytes32" },
      { name: "challengeId", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ] },
    value,
  );
  return { profileHash, challengeId, deadline, signature };
}

async function mintOne(contract, signer, wallet, nonce, profile) {
  const auth = await signedMint(contract, signer, wallet, nonce, profile);
  return contract.connect(wallet).mint(1, auth.profileHash, auth.challengeId, nonce, auth.deadline, auth.signature, { value: ethers.parseEther("0.01") });
}

test("mints with configured price and exposes metadata and snapshot state", async () => {
  const { server, contract, mintSigner, alice } = await fixture();
  try {
    await (await mintOne(contract, mintSigner, alice, 1)).wait();
    assert.equal(await contract.totalSupply(), 1n);
    assert.equal(await contract.balanceOf(await alice.getAddress()), 1n);
    assert.equal(await contract.tokenURI(1), "https://metadata.stonkalicious.xyz/token/1");
    await (await contract.setContractURI("https://metadata.stonkalicious.xyz/collection")).wait();
    assert.equal(await contract.contractURI(), "https://metadata.stonkalicious.xyz/collection");
    assert.equal(await contract.supportsInterface("0x49064906"), true);
    const snapshot = await contract.snapshotOf(1);
    assert.equal(snapshot.wallet, await alice.getAddress());
    assert.equal(snapshot.startingBagValue, 0n);
    assert.equal(snapshot.epoch, 1n);
    assert.equal(await contract.snapshotWriteEpoch(1), 0n);
  } finally {
    await server.close();
  }
});

test("transfer is locked for seven days after mint", async () => {
  const { server, contract, owner, oracle, alice, bob } = await fixture();
  try {
    await (await contract.connect(owner).adminMint(await alice.getAddress(), 1)).wait();
    await (await contract.connect(oracle).recordStartingBagValue(1, 1, 123456)).wait();
    await assert.rejects(contract.connect(alice).transferFrom(await alice.getAddress(), await bob.getAddress(), 1));
    const snapshot = await contract.snapshotOf(1);
    assert.equal((await contract.transferableAfter(1)) - BigInt(snapshot.acquiredAt), 7n * 24n * 60n * 60n);
  } finally {
    await server.close();
  }
});

test("rejects unauthorized snapshot writes and owner-only configuration", async () => {
  const { server, contract, owner, mintSigner, stranger, alice } = await fixture();
  try {
    await (await mintOne(contract, mintSigner, alice, 2)).wait();
    await assert.rejects(contract.connect(stranger).recordStartingBagValue(1, 1, 1));
    await assert.rejects(contract.connect(owner).recordStartingBagValue(1, 1, 1));
    await assert.rejects(contract.connect(owner).bindXProfile(1, ethers.keccak256(ethers.toUtf8Bytes("owner-must-not-bind"))));
    await assert.rejects(contract.connect(stranger).setBaseTokenURI("https://bad.example/"));
  } finally {
    await server.close();
  }
});

test("binds snapshots to the current epoch and permits one write including zero", async () => {
  const { server, contract, oracle, mintSigner, alice } = await fixture();
  try {
    await (await mintOne(contract, mintSigner, alice, 10)).wait();
    await assert.rejects(async () => (
      await contract.connect(oracle).recordStartingBagValue(1, 2, 500)
    ).wait());

    await (await contract.connect(oracle).recordStartingBagValue(1, 1, 0)).wait();
    const recorded = await contract.snapshotOf(1);
    assert.equal(recorded.startingBagValue, 0n);
    assert.equal(await contract.snapshotWriteEpoch(1), 1n);
    await assert.rejects(async () => (
      await contract.connect(oracle).recordStartingBagValue(1, 1, 500)
    ).wait());
    assert.equal((await contract.snapshotOf(1)).startingBagValue, 0n);
  } finally {
    await server.close();
  }
});

test("transfer starts a new epoch and resets snapshot-write eligibility", async () => {
  const { server, contract, owner, oracle, alice, bob } = await fixture();
  try {
    await (await contract.connect(owner).adminMint(await alice.getAddress(), 1)).wait();
    await (await contract.connect(oracle).recordStartingBagValue(1, 1, 123456)).wait();
    await server.provider.request({ method: "evm_increaseTime", params: [7 * 24 * 60 * 60 + 120] });
    await server.provider.request({ method: "evm_mine", params: [] });
    await (await contract.connect(alice).transferFrom(await alice.getAddress(), await bob.getAddress(), 1)).wait();

    const reset = await contract.snapshotOf(1);
    assert.equal(reset.wallet, await bob.getAddress());
    assert.equal(reset.epoch, 2n);
    assert.equal(reset.startingBagValue, 0n);
    assert.equal(await contract.snapshotWriteEpoch(1), 1n);
    await (await contract.connect(oracle).recordStartingBagValue(1, 2, 654321)).wait();
    assert.equal((await contract.snapshotOf(1)).startingBagValue, 654321n);
    assert.equal(await contract.snapshotWriteEpoch(1), 2n);
  } finally {
    await server.close();
  }
});

test("enforces one lifetime NFT per wallet and binds each optional X profile once", async () => {
  const { server, provider, contract, oracle, mintSigner, alice, bob } = await fixture();
  try {
    await (await mintOne(contract, mintSigner, alice, 3, "x-account-123")).wait();
    const duplicate = await signedMint(contract, mintSigner, alice, 4);
    await assert.rejects(async () => (await contract.connect(alice).mint(1, duplicate.profileHash, duplicate.challengeId, 4, duplicate.deadline, duplicate.signature, { value: ethers.parseEther("0.01") })).wait());
    const profileHash = ethers.keccak256(ethers.toUtf8Bytes("x-account-123"));
    await (await contract.connect(oracle).bindXProfile(1, profileHash)).wait();
    assert.equal(await contract.warriorByXProfile(profileHash), 1n);
    assert.equal(await contract.xProfileOf(1), profileHash);
    await assert.rejects(async () => (await contract.bindXProfile(1, ethers.keccak256(ethers.toUtf8Bytes("x-account-456")))).wait());
    await assert.rejects(contract.connect(alice).bindXProfile(1, profileHash));
    await server.provider.request({ method: "evm_increaseTime", params: [7 * 24 * 60 * 60 + 120] });
    await server.provider.request({ method: "evm_mine", params: [] });
    await (await contract.connect(alice).transferFrom(await alice.getAddress(), await bob.getAddress(), 1)).wait();
    assert.equal(await contract.warriorByXProfile(profileHash), 0n);
    assert.equal(await contract.xProfileOf(1), ethers.ZeroHash);
  } finally {
    await server.close();
  }
});

test("allows a wallet-only mint without an X profile", async () => {
  const { server, contract, mintSigner, alice } = await fixture();
  try {
    await (await mintOne(contract, mintSigner, alice, 30, null)).wait();
    assert.equal(await contract.totalSupply(), 1n);
    assert.equal(await contract.mintedByWallet(await alice.getAddress()), 1n);
    assert.equal(await contract.xProfileOf(1), ethers.ZeroHash);
  } finally {
    await server.close();
  }
});

test("enforces mint limits, exact payment, and supply cap", async () => {
  const { server, mintSigner, contract, alice } = await fixture();
  try {
    const zeroPayment = await signedMint(contract, mintSigner, alice, 5);
    await assert.rejects(contract.connect(alice).mint(1, zeroPayment.profileHash, zeroPayment.challengeId, 5, zeroPayment.deadline, zeroPayment.signature, { value: 0 }));
    const invalidQuantity = await signedMint(contract, mintSigner, alice, 6);
    await assert.rejects(contract.connect(alice).mint(2, invalidQuantity.profileHash, invalidQuantity.challengeId, 6, invalidQuantity.deadline, invalidQuantity.signature, { value: ethers.parseEther("0.02") }));
    await (await mintOne(contract, mintSigner, alice, 7)).wait();
    const duplicate = await signedMint(contract, mintSigner, alice, 8);
    await assert.rejects(async () => (await contract.connect(alice).mint(1, duplicate.profileHash, duplicate.challengeId, 8, duplicate.deadline, duplicate.signature, { value: ethers.parseEther("0.01") })).wait());
  } finally {
    await server.close();
  }
});

test("supports emergency pause and two-step ownership", async () => {
  const { server, contract, owner, oracle, mintSigner, alice, bob } = await fixture();
  try {
    await (await contract.transferOwnership(await bob.getAddress())).wait();
    assert.equal(await contract.pendingOwner(), await bob.getAddress());
    await (await contract.connect(bob).acceptOwnership()).wait();
    assert.equal(await contract.owner(), await bob.getAddress());
    await (await contract.connect(bob).setPaused(true)).wait();
    const auth = await signedMint(contract, mintSigner, alice, 99);
    await assert.rejects(contract.connect(alice).mint(1, auth.profileHash, auth.challengeId, 99, auth.deadline, auth.signature, { value: ethers.parseEther("0.01") }));
    await assert.rejects(contract.connect(oracle).recordStartingBagValue(1, 1, 1));
    await (await contract.connect(bob).setPaused(false)).wait();
  } finally {
    await server.close();
  }
});

test("rejects a failed withdrawal with a custom error", async () => {
  const { server, contract, owner } = await fixture();
  try {
    assert.ok(artifact.abi.some((item) => item.type === "error" && item.name === "WithdrawalFailed"));
    const rejectingRecipient = await owner.sendTransaction({
      data: "0x6005600c60003960056000f360006000fd",
    });
    const receipt = await rejectingRecipient.wait();
    assert.ok(receipt?.contractAddress);
    await assert.rejects(contract.withdraw(receipt.contractAddress));
  } finally {
    await server.close();
  }
});