/**
 * Configure endpoint step by step with detailed error checking
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
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", ownEndpoint.receiveUln302);

  console.log("🔍 Step-by-step Configuration\n");

  // Step 1: Verify EID support
  console.log("Step 1: Verify EID support");
  const sendSupports = await sendUln.isSupportedEid(1315);
  const receiveSupports = await receiveUln.isSupportedEid(1315);
  console.log("   SendUln302 supports 1315:", sendSupports);
  console.log("   ReceiveUln302 supports 1315:", receiveSupports);

  if (!receiveSupports) {
    console.log("\n   Configuring ReceiveUln302...");
    const receiveUlnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [storyInfra.receiveUln302]
    };
    const tx = await receiveUln.setDefaultUlnConfigs([{ eid: 1315, config: receiveUlnConfig }]);
    await tx.wait();
    console.log("   ✅ ReceiveUln302 configured");
  }

  // Step 2: Set default libraries
  console.log("\nStep 2: Set default libraries");
  try {
    const tx1 = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Default send library set");
  } catch (e) {
    console.log("   ⚠️  Default send library:", e.message);
  }

  try {
    const tx2 = await endpoint.setDefaultReceiveLibrary(1315, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Default receive library set");
  } catch (e) {
    console.log("   ⚠️  Default receive library:", e.message);
  }

  // Step 3: Set per-OApp libraries
  console.log("\nStep 3: Set per-OApp libraries");
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("   Delegate:", delegate);
  console.log("   Deployer:", deployer.address);
  console.log("   Match:", delegate.toLowerCase() === deployer.address.toLowerCase());

  try {
    const tx3 = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
    await tx3.wait();
    console.log("   ✅ OApp send library set");
  } catch (e) {
    console.error("   ❌ OApp send library failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      // Try to decode error
      try {
        const errorInterface = new hre.ethers.Interface([
          "error LZ_UnsupportedEid(uint32 eid)",
          "error LZ_Unauthorized()",
          "error LZ_UnsupportedInterface()"
        ]);
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded error:", decoded.name, decoded.args);
      } catch {}
    }
  }

  try {
    const tx4 = await endpoint.setReceiveLibrary(baseOft.address, 1315, ownEndpoint.receiveUln302, 0);
    await tx4.wait();
    console.log("   ✅ OApp receive library set");
  } catch (e) {
    console.error("   ❌ OApp receive library failed:", e.message);
  }

  console.log("\n✅ Configuration complete!");
}

main().catch(console.error);
