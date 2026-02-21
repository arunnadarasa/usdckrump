/**
 * Check if our SendUln302 is registered with the official endpoint
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("Checking library registration:\n");
  
  const endpoint = await hre.ethers.getContractAt("MessageLibManager", OFFICIAL_ENDPOINT);
  
  // Get all registered libraries
  try {
    const registeredLibs = await endpoint.getRegisteredLibraries();
    console.log("Registered libraries:", registeredLibs.length);
    console.log("Our SendUln302:", ownEndpoint.sendUln302);
    console.log("Is registered?", registeredLibs.includes(ownEndpoint.sendUln302) ? "✅ YES" : "❌ NO");
    
    if (registeredLibs.length > 0) {
      console.log("\nFirst few registered libraries:");
      registeredLibs.slice(0, 5).forEach((lib, i) => {
        console.log(`  ${i + 1}. ${lib}`);
      });
    }
  } catch (e) {
    console.log("❌ Error:", e.message);
  }
}

main().catch(console.error);
