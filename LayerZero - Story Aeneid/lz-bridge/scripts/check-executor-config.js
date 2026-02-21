/**
 * Check executor configuration for SendUln302
 * The error might be that executor config is not set
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Checking Executor Configuration\n");
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Test sender:", signer.address);
  console.log("Story Aeneid EID: 1315\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;

  // Check executor config via endpoint.getConfig()
  console.log("1. Checking executor config via endpoint.getConfig():");
  try {
    // configType 1 = Executor config
    const configBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
    const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      configBytes
    )[0];
    
    console.log("   Max message size:", config.maxMessageSize.toString());
    console.log("   Executor:", config.executor);
    console.log("   Executor is zero:", config.executor === "0x0000000000000000000000000000000000000000" ? "❌" : "✅");
    
    if (config.executor === "0x0000000000000000000000000000000000000000") {
      console.log("\n   ⚠️  Executor is not set!");
      console.log("   This might cause issues, but wouldn't cause LZ_DefaultSendLibUnavailable()");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check executor config directly on SendUln302
  console.log("\n2. Checking executor config directly on SendUln302:");
  try {
    const config = await sendUln.executorConfigs(testSender, dstEid);
    console.log("   Max message size:", config.maxMessageSize.toString());
    console.log("   Executor:", config.executor);
    
    // Check default config
    const defaultConfig = await sendUln.executorConfigs("0x0000000000000000000000000000000000000000", dstEid);
    console.log("\n   Default config:");
    console.log("   Max message size:", defaultConfig.maxMessageSize.toString());
    console.log("   Executor:", defaultConfig.executor);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check ULN config
  console.log("\n3. Checking ULN config:");
  try {
    const ulnConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 2);
    const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      ulnConfigBytes
    )[0];
    
    console.log("   Confirmations:", ulnConfig.confirmations.toString());
    console.log("   Required DVN count:", ulnConfig.requiredDVNCount.toString());
    console.log("   Required DVNs:", ulnConfig.requiredDVNs.length);
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    
    if (ulnConfig.requiredDVNCount === 0 && ulnConfig.optionalDVNCount === 0) {
      console.log("\n   ⚠️  No DVNs configured!");
      console.log("   This might cause verification issues");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test if executor.getFee() works
  console.log("\n4. Testing executor.getFee() directly:");
  try {
    const configBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
    const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      configBytes
    )[0];
    
    if (config.executor !== "0x0000000000000000000000000000000000000000") {
      const executor = await hre.ethers.getContractAt("ILayerZeroExecutor", config.executor);
      const fee = await executor.getFee(dstEid, testSender, 0, "0x");
      console.log("   ✅ Executor.getFee() works");
      console.log("   Fee:", hre.ethers.formatEther(fee), "ETH");
    } else {
      console.log("   ⚠️  Executor is zero, cannot test");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
