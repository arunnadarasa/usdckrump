/**
 * Final setup: Configure USDCKrumpOFT to use our SendUln302
 * Since we can't modify LayerZero's official endpoint, we'll document the manual steps
 * and provide a workaround using our executor worker
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
  console.log("⚙️  Final ULN Setup for USDCKrumpOFT\n");
  console.log("=".repeat(60));

  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const sendUln302 = baseEndpoint.sendUln302 || "0x1f860C493FdF423187D31673E5338C1276b6F630";
  
  console.log("USDCKrumpOFT:", baseOft.address);
  console.log("SendUln302:", sendUln302);
  console.log("Endpoint:", baseEndpoint.endpointV2);
  console.log("Story ReceiveUln302:", storyInfra.receiveUln302, "\n");

  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    baseEndpoint.endpointV2
  );

  // Check current send library
  let currentSendLib;
  try {
    currentSendLib = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("Current send library:", currentSendLib);
  } catch (e) {
    currentSendLib = "0x0000000000000000000000000000000000000000";
    console.log("No send library configured");
  }

  // Try to set send library (will likely fail on official endpoint)
  console.log("\nAttempting to set send library...");
  try {
    const tx = await endpoint.setSendLibrary(baseOft.address, 1315, sendUln302);
    await tx.wait();
    console.log("✅ Send library configured!");
    console.log("\n🎉 Setup complete! You can now test LayerZero sends.");
    return;
  } catch (e) {
    console.log("⚠️  Cannot set send library via endpoint (expected on official endpoint)");
    console.log("   Error:", e.message);
  }

  // Verify SendUln302 supports EID 1315
  const sendUln = await hre.ethers.getContractAt("SendUln302", sendUln302);
  const isSupported = await sendUln.isSupportedEid(1315);
  console.log("\nSendUln302 supports EID 1315:", isSupported);

  if (!isSupported) {
    console.log("❌ SendUln302 doesn't support EID 1315 yet!");
    console.log("   Run: npx hardhat run scripts/enable-story-eid-on-senduln.js --network baseSepolia");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 MANUAL CONFIGURATION REQUIRED");
  console.log("=".repeat(60));
  console.log("\nSince LayerZero's official endpoint requires admin permissions,");
  console.log("you need to configure the send library via one of these methods:\n");
  
  console.log("Option 1: LayerZero Dashboard (Recommended)");
  console.log("   1. Go to LayerZero's dashboard/UI");
  console.log("   2. Configure OApp:", baseOft.address);
  console.log("   3. Set send library for EID 1315:", sendUln302);
  console.log("   4. Configure ULN settings if needed\n");

  console.log("Option 2: Contact LayerZero Support");
  console.log("   Request them to add Story Aeneid (EID 1315) support");
  console.log("   Or request permission to configure libraries\n");

  console.log("Option 3: Use Executor Worker (Current Workaround)");
  console.log("   Your executor worker (lz-executor-worker.js) can handle messages");
  console.log("   But the send() call will still fail without library configuration");
  console.log("   You may need to modify the send flow or use a different approach\n");

  console.log("Option 4: Deploy Your Own Endpoint");
  console.log("   Deploy your own EndpointV2 on Base Sepolia");
  console.log("   Then you'll have full control over library configuration");
  console.log("   But this requires significant infrastructure changes\n");

  console.log("=".repeat(60));
  console.log("\n✅ SendUln302 is ready (EID 1315 enabled)");
  console.log("⏳ Waiting for send library configuration...");
}

main().catch((e) => {
  console.error("❌ Setup failed:", e.message);
  process.exit(1);
});
