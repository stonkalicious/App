import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import solc from "solc";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "src", "Stonkalicious.sol");
const source = await readFile(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: { "Stonkalicious.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
if (errors.length) {
  console.error(errors.map((error) => error.formattedMessage).join("\n"));
  process.exit(1);
}
const contract = output.contracts["Stonkalicious.sol"].Stonkalicious;
await mkdir(path.join(root, "artifacts"), { recursive: true });
await writeFile(
  path.join(root, "artifacts", "Stonkalicious.json"),
  JSON.stringify({ abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` }, null, 2)
);
console.log(`Compiled Stonkalicious (${contract.evm.bytecode.object.length / 2} bytes)`);