/**
 * Export Standard JSON-Input for BridgeVault for BaseScan verification.
 * Run: node scripts/export-bridge-vault-standard-input.js
 * Then upload the generated file on: sepolia.basescan.org (Verify Contract → Standard JSON Input).
 */
const fs = require("fs");
const path = require("path");

const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
const files = fs.readdirSync(buildInfoDir);
let buildInfoPath = null;
for (const f of files) {
  if (!f.endsWith(".json")) continue;
  const content = fs.readFileSync(path.join(buildInfoDir, f), "utf8");
  if (content.includes("BridgeVault")) {
    buildInfoPath = path.join(buildInfoDir, f);
    break;
  }
}
if (!buildInfoPath) {
  console.error("No build-info found containing BridgeVault. Run: npm run build");
  process.exit(1);
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
if (!buildInfo.input) {
  console.error("No input in build-info");
  process.exit(1);
}

const outPath = path.join(__dirname, "../standard-input-bridge-vault.json");
fs.writeFileSync(outPath, JSON.stringify(buildInfo.input, null, 0));
console.log("Written:", outPath);
console.log("Upload this file on BaseScan: Verify Contract → Compiler Type: STANDARD JSON-INPUT → Upload File.");
console.log("Contract:", "0xa594b9F302D411A7c2bB7d599eb7C635f3535b00");
console.log("Compiler: v0.8.20+commit.a1b79de6, Optimizer: 200 runs, Via-IR: Yes");
