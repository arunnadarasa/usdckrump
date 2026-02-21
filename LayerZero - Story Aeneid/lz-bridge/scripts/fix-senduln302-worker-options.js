/**
 * Fix SendUln302 worker options error (0x6592671c)
 * Verifies registration and tests quoteSend with proper options encoding
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
  console.log("🔧 Fixing SendUln302 Worker Options Error");
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

  // Step 1: Verify SendUln302 is registered
  console.log("1/4 Verifying SendUln302 registration...");
  const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  if (!isRegistered) {
    console.log("   ⚠️  SendUln302 not registered! Registering...");
    const endpointOwner = await endpoint.owner();
    if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("   ❌ Not endpoint owner! Cannot register library.");
      console.log("   Endpoint owner:", endpointOwner);
      process.exit(1);
    }
    try {
      const tx = await endpoint.registerLibrary(ownEndpoint.sendUln302);
      await tx.wait();
      console.log("   ✅ SendUln302 registered");
    } catch (e) {
      console.error("   ❌ Failed to register:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else {
    console.log("   ✅ SendUln302 is registered");
  }

  // Step 2: Verify SendUln302 supports Story Aeneid (EID 1315)
  console.log("\n2/4 Checking SendUln302 EID support...");
  const supportsEid = await sendUln.isSupportedEid(1315);
  if (!supportsEid) {
    console.log("   ⚠️  SendUln302 does not support EID 1315!");
    console.log("   Run: npm run configure:senduln-story");
    process.exit(1);
  }
  console.log("   ✅ SendUln302 supports EID 1315");

  // Step 3: Check SendUln302 configuration
  console.log("\n3/4 Checking SendUln302 configuration...");
  try {
    // Get ULN config for Story Aeneid
    const CONFIG_TYPE_ULN = 2;
    const configBytes = await sendUln.defaultUlnConfig(1315);
    console.log("   ✅ SendUln302 has ULN config for EID 1315");
    console.log("   Config length:", configBytes.length, "bytes");
  } catch (e) {
    console.log("   ⚠️  Could not read config:", e.message);
  }

  // Step 4: Test quoteSend with proper options
  console.log("\n4/4 Testing quoteSend with proper options encoding...");
  
  const amount = hre.ethers.parseUnits("0.1", 6);
  const dstEid = 1315; // Story Aeneid
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  // Try with empty options first (should work)
  const sendParamEmpty = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x", // Empty options
    composeMsg: "0x",
    oftCmd: "0x",
  };

  console.log("   Testing with empty options...");
  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParamEmpty, false);
    console.log("   ✅ quoteSend successful with empty options!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
  } catch (error) {
    console.log("   ❌ quoteSend failed:", error.message);
    if (error.data) {
      const errorSig = error.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      
      if (errorSig === "0x6592671c") {
        console.log("\n   🔍 Error 0x6592671c = LZ_ULN_InvalidWorkerOptions");
        console.log("   This suggests worker options are malformed.");
        console.log("\n   Possible causes:");
        console.log("   1. SendUln302 bytecode mismatch");
        console.log("   2. Options encoding issue in OFTAdapter");
        console.log("   3. SendUln302 not properly configured");
        
        // Try using combineOptions to properly encode
        console.log("\n   Attempting to use combineOptions...");
        try {
          const SEND = 1; // Message type for OFT send
          const properOptions = await proxyOft.combineOptions(dstEid, SEND, "0x");
          console.log("   Proper options:", properOptions);
          
          const sendParamWithOptions = {
            ...sendParamEmpty,
            extraOptions: properOptions,
          };
          
          const [nativeFee2] = await proxyOft.quoteSend(sendParamWithOptions, false);
          console.log("   ✅ quoteSend successful with combineOptions!");
          console.log("   Native Fee:", hre.ethers.formatEther(nativeFee2), "ETH");
        } catch (e2) {
          console.log("   ❌ Still failed:", e2.message);
          if (e2.data) console.log("   Error data:", e2.data);
        }
      }
    }
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ SendUln302 configuration verified!");
  console.log("=".repeat(60));
  console.log("\n💡 If quoteSend still fails, check:");
  console.log("   1. SendUln302 bytecode matches LayerZero V2");
  console.log("   2. SendUln302 is set as default/per-OApp send library");
  console.log("   3. Options are properly encoded using combineOptions()");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
