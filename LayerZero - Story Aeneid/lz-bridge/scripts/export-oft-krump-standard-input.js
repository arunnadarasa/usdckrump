/**
 * Export Standard JSON-Input for USDCKrumpOFT for BaseScan verification.
 * Run: node scripts/export-oft-krump-standard-input.js
 * Then upload on: sepolia.basescan.org → Verify Contract → STANDARD JSON-INPUT.
 */
const fs = require("fs");
const path = require("path");

const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
const files = fs.readdirSync(buildInfoDir);
let buildInfoPath = null;
for (const f of files) {
  if (!f.endsWith(".json")) continue;
  const content = fs.readFileSync(path.join(buildInfoDir, f), "utf8");
  if (content.includes("USDCKrumpOFT")) {
    buildInfoPath = path.join(buildInfoDir, f);
    break;
  }
}
if (!buildInfoPath) {
  console.error("No build-info found containing USDCKrumpOFT. Run: npm run build");
  process.exit(1);
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
if (!buildInfo.input) {
  console.error("No input in build-info");
  process.exit(1);
}

const outPath = path.join(__dirname, "../standard-input-oft-krump.json");
fs.writeFileSync(outPath, JSON.stringify(buildInfo.input, null, 0));
console.log("Written:", outPath);
console.log("Upload on BaseScan: Verify Contract → STANDARD JSON-INPUT → Upload File.");
console.log("Contract:", "0x4d124ee3CA5B8efa9b0bCA3d014698eB55E5CCdF");
console.log("Contract Name: contracts/USDCKrumpOFT.sol:USDCKrumpOFT");
console.log("Compiler: v0.8.20+commit.a1b79de6, Optimizer: 200 runs, Via-IR: Yes");
console.log("Constructor (ABI-encoded): use 0x6EDCE65403992e310A62460808c4b910D972f10f, 0x35df28Db852f528282Dd26AAa0C3968aac1d3a25, 0x35df28Db852f528282Dd26AAa0C3968aac1d3a25");
