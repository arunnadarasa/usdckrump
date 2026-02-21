/**
 * Verify SendUln302 setup and configuration
 * Check version, registration, EID support, and config
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
  console.log("🔍 Verifying SendUln302 Setup");
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
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  // Check 1: Version
  console.log("1/6 Checking SendUln302 version...");
  try {
    const [major, minor, endpointVersion] = await sendUln.version();
    console.log("   ✅ Version:", `${major}.${minor}.${endpointVersion}`);
    if (major !== 3n || minor !== 0n || endpointVersion !== 2n) {
      console.log("   ⚠️  Unexpected version! Expected 3.0.2");
    }
  } catch (e) {
    console.log("   ❌ Failed to get version:", e.message);
  }

  // Check 2: Registration
  console.log("\n2/6 Checking registration...");
  const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  console.log("   Registered:", isRegistered ? "✅ YES" : "❌ NO");

  // Check 3: EID Support
  console.log("\n3/6 Checking EID support...");
  const supportsEid = await sendUln.isSupportedEid(1315);
  console.log("   Supports EID 1315:", supportsEid ? "✅ YES" : "❌ NO");

  // Check 4: ULN Config
  console.log("\n4/6 Checking ULN config...");
  try {
    const CONFIG_TYPE_ULN = 2;
    const configBytes = await sendUln.getConfig(1315, proxyOftDeployment.oappProxyOft, CONFIG_TYPE_ULN);
    if (configBytes.length > 0) {
      console.log("   ✅ ULN config exists");
      console.log("   Config length:", configBytes.length, "bytes");
    } else {
      console.log("   ⚠️  ULN config is empty");
    }
  } catch (e) {
    console.log("   ❌ Failed to get ULN config:", e.message);
  }

  // Check 5: Executor Config
  console.log("\n5/6 Checking Executor config...");
  try {
    const CONFIG_TYPE_EXECUTOR = 1;
    const executorConfigBytes = await sendUln.getConfig(1315, proxyOftDeployment.oappProxyOft, CONFIG_TYPE_EXECUTOR);
    if (executorConfigBytes.length > 0) {
      console.log("   ✅ Executor config exists");
      console.log("   Config length:", executorConfigBytes.length, "bytes");
    } else {
      console.log("   ⚠️  Executor config is empty");
    }
  } catch (e) {
    console.log("   ❌ Failed to get Executor config:", e.message);
  }

  // Check 6: Send Library Assignment
  console.log("\n6/6 Checking send library assignment...");
  try {
    const [lib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
    console.log("   Send Library:", lib);
    console.log("   Is Default:", isDefault ? "YES" : "NO (per-OApp)");
    if (lib.toLowerCase() !== ownEndpoint.sendUln302.toLowerCase()) {
      console.log("   ⚠️  Library mismatch!");
      console.log("   Expected:", ownEndpoint.sendUln302);
      console.log("   Got:", lib);
    } else {
      console.log("   ✅ Correct library assigned");
    }
  } catch (e) {
    console.log("   ❌ Failed to get send library:", e.message);
  }

  // Try to decode the error
  console.log("\n" + "=".repeat(60));
  console.log("🔍 Error Analysis");
  console.log("=".repeat(60));
  console.log("\nError 0x6592671c = LZ_ULN_InvalidWorkerOptions");
  console.log("This error occurs in UlnOptions.decode() when:");
  console.log("  1. Options length < 2 bytes (line 32)");
  console.log("  2. Option size is 0 (line 73)");
  console.log("  3. Cursor doesn't match options length (line 78)");
  console.log("\n💡 Since all option formats fail, the issue is likely:");
  console.log("  1. SendUln302 bytecode mismatch");
  console.log("  2. SendUln302 not properly initialized");
  console.log("  3. Options parsing bug in deployed SendUln302");
  console.log("\n🔧 Recommended fix:");
  console.log("  1. Redeploy SendUln302 with exact LayerZero V2 source");
  console.log("  2. Or use official LayerZero infrastructure");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
