/**
 * Test if executor being zero causes the error
 * The executor config shows executor is zero, which might trigger unexpected behavior
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Testing Executor Zero Address Issue\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;

  // Check executor config
  console.log("1. Checking executor config:");
  const configBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
  const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    configBytes
  )[0];
  
  console.log("   Executor:", config.executor);
  console.log("   Is zero:", config.executor === "0x0000000000000000000000000000000000000000" ? "❌" : "✅");

  // Try calling executor.getFee() directly with zero address
  console.log("\n2. Testing executor.getFee() with zero address:");
  try {
    const executor = await hre.ethers.getContractAt("ILayerZeroExecutor", config.executor);
    const fee = await executor.getFee(dstEid, testSender, 0, "0x");
    console.log("   ✅ Executor.getFee() works");
    console.log("   Fee:", hre.ethers.formatEther(fee), "ETH");
  } catch (e) {
    console.log("   ❌ Executor.getFee() failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x6592671c") {
        console.log("   ⚠️  This is LZ_DefaultSendLibUnavailable()!");
        console.log("   The executor might be checking send libraries!");
      }
    }
  }

  // Test if setting executor config fixes the issue
  console.log("\n3. Checking if we need to set executor config:");
  console.log("   According to LayerZero docs, executor config must be set");
  console.log("   Current executor is zero, which might cause issues");
  console.log("   Need to set executor config using setConfig()");

  console.log("\n✅ Test complete");
}

main().catch(console.error);
