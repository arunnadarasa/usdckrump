/**
 * Fix send library resolution issue
 * The problem: getSendLibrary returns 0 even though default is set
 * Solution: Explicitly set sendLibrary to DEFAULT_LIB (address(0)) to force default resolution
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

  console.log("🔧 Fixing Send Library Resolution");
  console.log("=".repeat(60));
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // Check current state
  console.log("Current State:");
  const [currentLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  const defaultLib = await endpoint.defaultSendLibrary(1315);
  
  console.log("   getSendLibrary():", currentLib);
  console.log("   isDefaultSendLibrary():", isDefault);
  console.log("   defaultSendLibrary(1315):", defaultLib);
  console.log("   Expected:", ownEndpoint.sendUln302);
  
  // The issue: if sendLibrary[oapp][eid] is not DEFAULT_LIB, getSendLibrary returns that value
  // If it IS DEFAULT_LIB (address(0)), it resolves to defaultSendLibrary[eid]
  // But isDefaultSendLibrary returns false, suggesting it's NOT set to DEFAULT_LIB
  
  // Let's try to explicitly set it to the library address first, then to DEFAULT_LIB
  console.log("\n📝 Attempting Fix:");
  
  // Step 1: Try setting to the actual library address (might already be set, that's OK)
  console.log("1. Setting to library address...");
  try {
    const tx1 = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Set to library address");
  } catch (e) {
    if (e.message.includes("LZ_SameValue")) {
      console.log("   ✅ Already set to library address");
    } else {
      console.log("   ⚠️  Failed:", e.message);
    }
  }
  
  // Step 2: Now verify it resolves correctly
  console.log("\n2. Verifying resolution...");
  const [libAfter] = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("   getSendLibrary() after:", libAfter);
  console.log("   Expected:", ownEndpoint.sendUln302);
  console.log("   Match:", libAfter.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  
  if (libAfter.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
    console.log("\n✅ Send library is now correctly set!");
    
    // Test quote
    console.log("\n3. Testing quote...");
    const messagingParams = {
      dstEid: 1315,
      receiver: hre.ethers.zeroPadValue(deployer.address, 32),
      message: "0x",
      options: "0x",
      payInLzToken: false
    };
    
    try {
      const fee = await endpoint.quote(messagingParams, baseOft.address);
      console.log("   ✅ Quote successful!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    } catch (e) {
      console.log("   ❌ Quote still fails:", e.message);
      if (e.data) {
        console.log("   Error data:", e.data);
        const errorInterface = new hre.ethers.Interface([
          "error LZ_DefaultSendLibUnavailable()",
          "error LZ_UnsupportedEid()"
        ]);
        try {
          const decoded = errorInterface.parseError(e.data);
          console.log("   Decoded:", decoded.name);
        } catch {}
      }
    }
  } else {
    console.log("\n❌ Send library still not resolving correctly");
    console.log("   This suggests a deeper issue with the endpoint implementation");
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
