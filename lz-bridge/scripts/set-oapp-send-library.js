/**
 * Set send library for USDCKrumpOFT on our own endpoint
 * This should work since we're using default libraries
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

  console.log("⚙️  Setting Send Library for USDCKrumpOFT");
  console.log("=".repeat(60));
  console.log("OApp:", baseOft.address);
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Deployer:", deployer.address, "\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  // Check delegate
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("OApp delegate:", delegate);
  console.log("Deployer:", deployer.address);
  console.log("Match:", delegate.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌\n");

  // Check current send library
  try {
    const [currentLib, isDefault] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("Current send library:", currentLib);
    console.log("Is default:", isDefault);
    if (currentLib !== "0x0000000000000000000000000000000000000000") {
      console.log("✅ Send library already configured!");
      return;
    }
  } catch (e) {
    console.log("No send library configured yet\n");
  }

  // Try setting send library through OApp (as delegate)
  console.log("Setting send library...");
  try {
    // The OApp needs to call this, but we can call as delegate
    // Actually, we need to call through the endpoint as the delegate
    const tx = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
    console.log("   Transaction:", tx.hash);
    await tx.wait();
    console.log("   ✅ Send library configured!");
    
    // Verify
    const [newLib, isDefault] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   New library:", newLib);
    console.log("   Is default:", isDefault);
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      // Try to decode
      const errorInterface = new hre.ethers.Interface([
        "error LZ_UnsupportedEid()",
        "error LZ_Unauthorized()",
        "error LZ_UnsupportedInterface()"
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
