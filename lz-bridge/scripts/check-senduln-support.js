/**
 * Check if SendUln302 supports EID 1315
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  
  console.log("Checking SendUln302 support for EID 1315:\n");
  
  // Check our SendUln302
  console.log("1. Our SendUln302:", ownEndpoint.sendUln302);
  try {
    const ourSendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
    const supports = await ourSendUln.isSupportedEid(1315);
    console.log("   Supports EID 1315?", supports ? "✅ YES" : "❌ NO");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // Check official SendUln302
  console.log("\n2. Official SendUln302:", OFFICIAL_SEND_ULN);
  try {
    const officialSendUln = await hre.ethers.getContractAt("SendUln302", OFFICIAL_SEND_ULN);
    const supports = await officialSendUln.isSupportedEid(1315);
    console.log("   Supports EID 1315?", supports ? "✅ YES" : "❌ NO");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }
  
  // Check what EIDs are supported
  console.log("\n3. Checking supported EIDs...");
  // This would require iterating or checking specific known EIDs
}

main().catch(console.error);
