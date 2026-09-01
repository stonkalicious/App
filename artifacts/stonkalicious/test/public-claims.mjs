import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [app, index, openapi, contractReadme, checklist, threatModel] = await Promise.all([
  read("../src/App.tsx"),
  read("../index.html"),
  read("../../../lib/api-spec/openapi.yaml"),
  read("../../../contracts/README.md"),
  read("../../../contracts/TESTNET_LAUNCH_CHECKLIST.md"),
  read("../../../threat_model.md"),
]);
const normalized = (content) => content.replace(/\s+/g, " ").trim();

for (const [label, content, required] of [
  ["static page metadata", index, [
    "<title>King of the Hood</title>",
    '<meta property="og:title" content="King of the Hood" />',
    '<meta name="twitter:title" content="King of the Hood" />',
    "illustrative previews",
  ]],
  ["wallet and X claim flow", app, [
    "verify wallet control",
    "plain signature proves wallet control only",
    "does not link X, grant permissions, or move coins",
    "X OAuth consent is a separate step",
    "link X (optional)",
  ]],
  ["preview and ranking disclosures", app, [
    "illustrative card / no live result",
    "sample rank / sample holders",
    "sample growth",
    "sample data",
    "Live holder rankings are not enabled in this preview",
  ]],
  ["risk and lifecycle disclosures", app, [
    "Transfers are locked for seven days",
    "mutable metadata",
    "Minting is not open in this preview",
    "No guarantee of value, liquidity, uptime, or future performance",
  ]],
  ["supporting launch documentation", contractReadme, [
    "Wallet-only claim authorization",
    "The user signs a plain wallet-control message",
    "Metadata remains locked unless `METADATA_PUBLIC=true`",
  ]],
  ["metadata API contract", openapi, [
    "optional X verification may be included",
    "Signing it never approves a transaction or grants custody",
  ]],
  ["launch gates", checklist, [
    "final human/legal review of public claims",
    "Automatic no-go conditions",
    "illustrative wallet value, rank, growth figure",
  ]],
  ["threat-model escalation", threatModel, [
    "AI-assisted pre-launch review",
    "qualified human contract review",
    "Public claims, risk language, sample-data labels",
  ]],
]) {
  for (const phrase of required) assert.ok(normalized(content).includes(normalized(phrase)), `${label} must include: ${phrase}`);
}

for (const [label, content, forbidden] of [
  ["static page metadata", index, ["Your wallet, turned NFT", "pre-launch dynamic NFT performance mirror"]],
  ["wallet and X claim flow", app, ["verify your X identity", "Your wallet, turned NFT"]],
  ["metadata API contract", openapi, ["only after wallet proof and X verification"]],
]) {
  for (const phrase of forbidden) assert.doesNotMatch(content, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} must not include stale wording: ${phrase}`);
}

console.log("Public claims passed: wallet/X distinction, sample labels, risk language, metadata state, lifecycle limits, and launch gates checked.");