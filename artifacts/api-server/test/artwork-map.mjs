import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const mapUrl = new URL("../../../lib/warrior-config/src/artwork-map.json", import.meta.url);
const assetRoot = new URL("../../stonkalicious/public/warriors/", import.meta.url);
const artworkMap = JSON.parse(await readFile(mapUrl, "utf8"));

const expected = {
  newb: ["Beginning", "newb.png"],
  liquidated: ["Climbing", "liquidated.png"],
  back: ["Contender", "back.png"],
  wrecked: ["Stacked", "wrecked.png"],
  hardened: ["Forged", "hardened.png"],
  profitable: ["Master", "profitable.png"],
  elite: ["Elite", "elite.png"],
  plumber: ["God", "plumber.png"],
};

assert.deepEqual(Object.keys(artworkMap), Object.keys(expected), "all eight stages must be in canonical order");

const availableFiles = [];
for (const [stage, [level, filename]] of Object.entries(expected)) {
  const artwork = artworkMap[stage];
  assert.equal(artwork.level, level, `${stage} must keep its display level`);
  assert.equal(artwork.filename, filename, `${stage} must keep its canonical artwork filename`);
  if (artwork.status === "available") {
    await stat(new URL(filename, assetRoot));
    availableFiles.push(filename);
  } else {
    assert.equal(artwork.status, "blocked", `${stage} may only be available or explicitly blocked`);
    assert.match(artwork.blocker ?? "", /must not be presented as God artwork/, `${stage} needs an explicit blocker`);
  }
}

assert.equal(new Set(availableFiles).size, availableFiles.length, "available tiers must not share artwork files");

const fileHash = async (filename) => {
  const bytes = await readFile(new URL(filename, assetRoot));
  return createHash("sha256").update(bytes).digest("hex");
};
assert.equal(await fileHash("elite.png"), await fileHash("plumber.png"), "current Elite/God duplicate must remain detected");
assert.equal(artworkMap.plumber.status, "blocked", "God must stay blocked until a distinct approved asset is supplied");

console.log("Artwork map passed: eight stage/level mappings checked; duplicate God artwork remains explicitly blocked.");