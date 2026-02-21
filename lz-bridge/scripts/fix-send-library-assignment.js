/**
 * Fix send library assignment for OAppProxyOFT
 * The library is registered but not assigned, causing quoteSend to fail
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("🔧 Fixing Send Library Assignment");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  // Verify endpoint owner
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner! Cannot set libraries.");
    console.log("   Endpoint owner:", endpointOwner);
    process.exit(1);
  }
  console.log("✅ Verified as endpoint owner\n");

  // Check current state
  console.log("1/3 Checking current send library...");
  try {
    const [currentLib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
    console.log("   Current library:", currentLib);
    console.log("   Is default:", isDefault ? "YES" : "NO");
    
    if (currentLib === hre.ethers.ZeroAddress) {
      console.log("   ⚠️  No library assigned!");
    } else if (currentLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("   ✅ Correct library already assigned");
      return;
    }
  } catch (e) {
    console.log("   ⚠️  Error checking:", e.message);
  }

  // Step 1: Set default send library
  console.log("\n2/3 Setting default send library for EID 1315...");
  try {
    const tx1 = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Default send library set");
    
    // Verify
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    console.log("   Verified default:", defaultLib);
    if (defaultLib.toLowerCase() !== ownEndpoint.sendUln302.toLowerCase()) {
      console.log("   ⚠️  Mismatch! Expected:", ownEndpoint.sendUln302);
    }
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.error("   Error signature:", errorSig);
      if (errorSig === "0x391daaa4") {
        console.log("   ⚠️  Error 0x391daaa4 = LZ_ULN_UnsupportedEid");
        console.log("   SendUln302 doesn't support EID 1315!");
        console.log("   Run: npm run configure:senduln-story");
        process.exit(1);
      }
    }
    process.exit(1);
  }

  // Step 2: Set per-OApp send library (optional, will use default if this fails)
  console.log("\n3/3 Setting per-OApp send library...");
  try {
    const tx2 = await endpoint.setSendLibrary(
      proxyOftDeployment.oappProxyOft,
      1315,
      ownEndpoint.sendUln302
    );
    await tx2.wait();
    console.log("   ✅ Per-OApp send library set");
  } catch (e) {
    console.log("   ⚠️  Per-OApp setting failed:", e.message);
    console.log("   (Will use default library instead)");
  }

  // Verify final state
  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification");
  console.log("=".repeat(60));
  try {
    const [finalLib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
    console.log("   Final library:", finalLib);
    console.log("   Is default:", isDefault ? "YES" : "NO");
    
    if (finalLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n   ✅ Send library correctly assigned!");
      console.log("\n   🧪 Now test quoteSend:");
      console.log("      npm run test:proxy-oft -- --network baseSepolia");
    } else {
      console.log("\n   ⚠️  Library still not set correctly");
      console.log("   Expected:", ownEndpoint.sendUln302);
      console.log("   Got:", finalLib);
    }
  } catch (e) {
    console.log("   ⚠️  Error verifying:", e.message);
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
