/**
 * Check SendUln302 configuration for OAppProxyOFT
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  
  console.log("🔍 Checking SendUln302 Configuration\n");
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("Story Aeneid EID: 1315\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  // Check if SendUln302 supports EID 1315
  console.log("1. Checking if SendUln302 supports EID 1315:");
  try {
    const isSupported = await sendUln.isSupportedEid(1315);
    console.log("   isSupportedEid(1315):", isSupported ? "✅ Yes" : "❌ No");
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check default ULN config
  console.log("\n2. Checking default ULN config for EID 1315:");
  try {
    const config = await sendUln.defaultUlnConfig(1315);
    console.log("   Config:", {
      confirmations: config.confirmations.toString(),
      requiredDVNCount: config.requiredDVNCount.toString(),
      optionalDVNCount: config.optionalDVNCount.toString(),
      optionalDVNThreshold: config.optionalDVNThreshold.toString(),
    });
  } catch (e) {
    console.log("   Error:", e.message);
    // Try alternative
    try {
      const configBytes = await sendUln.getConfig(1315);
      console.log("   getConfig(1315) bytes length:", configBytes.length);
    } catch (e2) {
      console.log("   Alternative also failed:", e2.message);
    }
  }

  // Check send library
  console.log("\n3. Checking send library for OAppProxyOFT → Story Aeneid:");
  try {
    const [lib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
    console.log("   Library:", lib);
    console.log("   Is Default:", isDefault);
    console.log("   Matches SendUln302:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check executor config
  console.log("\n4. Checking executor config:");
  try {
    const executorConfig = await endpoint.getConfig(
      proxyOftDeployment.oappProxyOft,
      ownEndpoint.sendUln302,
      1315,
      1 // CONFIG_TYPE_EXECUTOR
    );
    console.log("   Executor config bytes length:", executorConfig.length);
    if (executorConfig.length > 0) {
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["tuple(address executor, tuple(uint128 gas, uint128 value) lzReceiveOption)"],
        executorConfig
      );
      console.log("   Executor:", decoded[0].executor);
      console.log("   Gas:", decoded[0].lzReceiveOption.gas.toString());
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
