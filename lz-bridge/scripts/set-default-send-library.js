/**
 * Set send library to DEFAULT_LIB to use default library
 * DEFAULT_LIB is typically 0x0000000000000000000000000000000000000001
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  console.log("⚙️  Setting Send Library to DEFAULT_LIB");
  console.log("=".repeat(60));
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // DEFAULT_LIB is typically 0x0000000000000000000000000000000000000001
  const DEFAULT_LIB = "0x0000000000000000000000000000000000000001";
  
  console.log("OApp:", baseOft.address);
  console.log("Setting to DEFAULT_LIB:", DEFAULT_LIB);
  console.log("This will use default send library:", ownEndpoint.sendUln302, "\n");

  try {
    const tx = await endpoint.setSendLibrary(baseOft.address, 1315, DEFAULT_LIB);
    console.log("   Transaction:", tx.hash);
    await tx.wait();
    console.log("   ✅ Set to DEFAULT_LIB!");
    
    // Verify
    const [lib, isDefault] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Resolved library:", lib);
    console.log("   Is default:", isDefault);
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    
    // Try setting directly to the library address instead
    console.log("\n   Trying to set directly to library address...");
    try {
      const tx2 = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
      await tx2.wait();
      console.log("   ✅ Set directly to library!");
    } catch (e2) {
      console.error("   ❌ Also failed:", e2.message);
      if (e2.data) console.error("   Error data:", e2.data);
    }
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
