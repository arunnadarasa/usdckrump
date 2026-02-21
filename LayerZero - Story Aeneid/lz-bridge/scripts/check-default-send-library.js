/**
 * Check default send library directly
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

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Checking Default Send Library");
  console.log("=".repeat(60));
  
  const defaultLib = await endpoint.defaultSendLibrary(1315);
  console.log("Default send library for EID 1315:", defaultLib);
  console.log("Expected:", ownEndpoint.sendUln302);
  console.log("Match:", defaultLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅ YES" : "❌ NO");
  
  const [oappLib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
  console.log("\nOApp send library:", oappLib);
  console.log("Is default:", isDefault ? "YES" : "NO");
  
  if (defaultLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() && oappLib === hre.ethers.ZeroAddress) {
    console.log("\n💡 Issue: Default library is set, but getSendLibrary() returns 0");
    console.log("   This might be a bug or the library needs to be set differently.");
  }
}

main().catch(console.error);
