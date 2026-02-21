/**
 * Export Standard JSON-Input for BridgeVault for BaseScan verification.
 * Run: node scripts/export-bridge-vault-standard-input.js
 * Then upload the generated file on: sepolia.basescan.org/verifyContract-solc-json?a=0x8e8bc0A151311e3E7Ed2c0AA514fbbB4a0284a04
 */
const fs = require("fs");
const path = require("path");

const buildInfoPath = path.join(
  __dirname,
  "../artifacts/build-info/e80a32cdbf686170c61db5cb56fa66e5.json"
);
const outPath = path.join(__dirname, "../standard-input-bridge-vault.json");

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
if (!buildInfo.input) {
  console.error("No input in build-info");
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(buildInfo.input));
console.log("Written:", outPath);
console.log("Upload this file on BaseScan Standard JSON-Input verification page.");
