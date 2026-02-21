/**
 * Set send library to address(0) to use default
 * DEFAULT_LIB = address(0)
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

  console.log("⚙️  Setting Send Library to address(0) to use default");
  console.log("=".repeat(60));
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // DEFAULT_LIB is address(0)
  const DEFAULT_LIB = "0x0000000000000000000000000000000000000000";
  
  console.log("OApp:", baseOft.address);
  console.log("Setting to DEFAULT_LIB (address(0))");
  console.log("This will use default send library:", ownEndpoint.sendUln302, "\n");

  // First verify default is set
  const defaultSend = await endpoint.defaultSendLibrary(1315);
  console.log("Default send library:", defaultSend);
  if (defaultSend === "0x0000000000000000000000000000000000000000") {
    console.error("❌ Default send library not set!");
    process.exit(1);
  }

  try {
    // Set to address(0) to use default
    const tx = await endpoint.setSendLibrary(baseOft.address, 1315, DEFAULT_LIB);
    console.log("   Transaction:", tx.hash);
    await tx.wait();
    console.log("   ✅ Set to DEFAULT_LIB (address(0))!");
    
    // Verify - should now resolve to default
    const [lib] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    console.log("   Resolved library:", lib);
    console.log("   Is default:", isDefault);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()",
        "error LZ_Unauthorized()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded:", decoded.name);
      } catch {}
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
