/**
 * Check if default executor config is set correctly
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Checking Default Executor Config\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const dstEid = 1315;
  const DEFAULT_CONFIG = "0x0000000000000000000000000000000000000000";

  // Check default executor config (for DEFAULT_CONFIG address)
  console.log("1. Checking default executor config:");
  try {
    const defaultConfig = await sendUln.executorConfigs(DEFAULT_CONFIG, dstEid);
    console.log("   Executor:", defaultConfig.executor);
    console.log("   Max message size:", defaultConfig.maxMessageSize.toString());
    
    if (defaultConfig.executor === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ Default executor config is NOT set!");
    } else {
      console.log("   ✅ Default executor config is set");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check custom config for test sender
  console.log("\n2. Checking custom executor config for test sender:");
  try {
    const customConfig = await sendUln.executorConfigs(signer.address, dstEid);
    console.log("   Executor:", customConfig.executor);
    console.log("   Max message size:", customConfig.maxMessageSize.toString());
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check via endpoint.getConfig() which should return the resolved config
  console.log("\n3. Checking resolved executor config via endpoint.getConfig():");
  try {
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    const configBytes = await endpoint.getConfig(signer.address, ownEndpoint.sendUln302, dstEid, 1);
    const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      configBytes
    )[0];
    
    console.log("   Executor:", config.executor);
    console.log("   Max message size:", config.maxMessageSize.toString());
    
    if (config.executor === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ Resolved executor config is still zero!");
      console.log("   This means getExecutorConfig() is not falling back to default");
    } else {
      console.log("   ✅ Resolved executor config is set");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
