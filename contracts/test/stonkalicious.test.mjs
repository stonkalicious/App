import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ethers } from "ethers";
import ganache from "ganache";

const artifact = JSON.parse(await readFile(new URL("../artifacts/Stonkalicious.json", import.meta.url)));

async function fixture() {
  const server = ganache.server({ logging: { quiet: true }, wallet: { totalAccounts: 4 } });
  await server.listen(0);
  const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${server.address().port}`);
  const [owner, alice, bob, stranger] = await Promise.all([0, 1, 2, 3].map((index) => provider.getSigner(index)));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(10, ethers.parseEther("0.01"), 3, "https://metadata.stonkalicious.xyz/token/", await owner.getAddress());
  await contract.waitForDeployment();
  return { server, provider, contract, owner, alice, bob, stranger };
}

test("mints with configured price and exposes metadata and snapshot state", async () => {
  const { server, contract, alice } = await fixture();
  try {
    await (await contract.connect(alice).mint(2, { value: ethers.parseEther("0.02") })).wait();
    assert.equal(await contract.totalSupply(), 2n);
    assert.equal(await contract.balanceOf(await alice.getAddress()), 2n);
    assert.equal(await contract.tokenURI(1), "https://metadata.stonkalicious.xyz/token/1");
    const snapshot = await contract.snapshotOf(1);
    assert.equal(snapshot.wallet, await alice.getAddress());
    assert.equal(snapshot.startingBagValue, 0n);
    assert.equal(snapshot.epoch, 1n);
  } finally {
    await server.close();
  }
});

test("transfer resets the snapshot and increments its epoch", async () => {
  const { server, contract, owner, alice, bob } = await fixture();
  try {
    await (await contract.connect(owner).adminMint(await alice.getAddress(), 1)).wait();
    await (await contract.recordStartingBagValue(1, 123456)).wait();
    await (await contract.connect(alice).transferFrom(await alice.getAddress(), await bob.getAddress(), 1)).wait();
    const snapshot = await contract.snapshotOf(1);
    assert.equal(snapshot.wallet, await bob.getAddress());
    assert.equal(snapshot.startingBagValue, 0n);
    assert.equal(snapshot.epoch, 2n);
  } finally {
    await server.close();
  }
});

test("rejects unauthorized snapshot writes and owner-only configuration", async () => {
  const { server, contract, stranger, alice } = await fixture();
  try {
    await (await contract.connect(alice).mint(1, { value: ethers.parseEther("0.01") })).wait();
    await assert.rejects(contract.connect(stranger).recordStartingBagValue(1, 1));
    await assert.rejects(contract.connect(stranger).setBaseTokenURI("https://bad.example/"));
  } finally {
    await server.close();
  }
});

test("enforces mint limits, exact payment, and supply cap", async () => {
  const { server, contract, alice } = await fixture();
  try {
    await assert.rejects(contract.connect(alice).mint(1, { value: 0 }));
    await assert.rejects(contract.connect(alice).mint(4, { value: ethers.parseEther("0.04") }));
    await (await contract.connect(alice).mint(3, { value: ethers.parseEther("0.03") })).wait();
    await assert.rejects(contract.connect(alice).mint(1, { value: ethers.parseEther("0.01") }));
  } finally {
    await server.close();
  }
});