/**
 * Check send library for all possible OApp addresses and EIDs
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Checking All OApp Library Configurations");
  console.log("=".repeat(60));
  
  // Check current OApp
  console.log("Current OApp:", baseOft.address);
  console.log("EID: 1315\n");
  
  const [lib1] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault1 = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  console.log("getSendLibrary():", lib1);
  console.log("isDefaultSendLibrary():", isDefault1);
  
  // Check old OApp addresses
  console.log("\nChecking old OApp addresses...");
  const oldDeployments = [
    "deployments/usdckrump-base-sepolia-old-1771583588459.json",
    "deployments/usdckrump-base-sepolia-old-1771581950537.json"
  ];
  
  for (const oldFile of oldDeployments) {
    try {
      const oldOft = JSON.parse(fs.readFileSync(oldFile, "utf8"));
      console.log(`\nOld OApp: ${oldOft.address}`);
      const [oldLib] = await endpoint.getSendLibrary(oldOft.address, 1315);
      const oldIsDefault = await endpoint.isDefaultSendLibrary(oldOft.address, 1315);
      console.log("   getSendLibrary():", oldLib);
      console.log("   isDefaultSendLibrary():", oldIsDefault);
      
      if (oldLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
        console.log("   ✅ This old OApp has the library set!");
        console.log("   💡 Maybe we need to use this address or clear it first");
      }
    } catch (e) {
      // File might not exist
    }
  }
  
  // Check if maybe the issue is that we're checking the wrong EID
  console.log("\nChecking different EIDs...");
  const eids = [1315, 84532];
  for (const eid of eids) {
    const [lib] = await endpoint.getSendLibrary(baseOft.address, eid);
    console.log(`   EID ${eid}:`, lib);
  }
  
  // Summary
  console.log("\n📋 Summary:");
  console.log("   - Current OApp library returns 0");
  console.log("   - setSendLibrary says LZ_SameValue (already set)");
  console.log("   - This suggests a storage/read mismatch");
  console.log("\n💡 Possible solutions:");
  console.log("   1. Clear the library first (set to DEFAULT_LIB)");
  console.log("   2. Check if there's a proxy/upgrade issue");
  console.log("   3. Verify the OApp address is correct");
}

main().catch(console.error);
