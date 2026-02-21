/**
 * Check default libraries on endpoint
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
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Checking Default Libraries\n");
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("Story Aeneid EID: 1315\n");

  // Check default send library
  try {
    const defaultSendLib = await endpoint.defaultSendLibrary(1315);
    console.log("Default Send Library for EID 1315:", defaultSendLib);
    console.log("Matches SendUln302:", defaultSendLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("Error checking default send library:", e.message);
  }

  // Check default receive library
  try {
    const defaultRecvLib = await endpoint.defaultReceiveLibrary(1315);
    console.log("Default Receive Library for EID 1315:", defaultRecvLib);
    console.log("Matches ReceiveUln302:", defaultRecvLib.toLowerCase() === ownEndpoint.receiveUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("Error checking default receive library:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
