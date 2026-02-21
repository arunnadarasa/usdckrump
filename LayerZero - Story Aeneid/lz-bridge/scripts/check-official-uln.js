/**
 * Check if LayerZero's official SendUln302 on Base Sepolia supports Story Aeneid (EID 1315)
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // LayerZero's official SendUln302 on Base Sepolia
  // From docs: https://docs.layerzero.network/v2/deployments/chains/base-sepolia
  // We need to find the actual address - let's check the endpoint's default libraries
  
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    baseEndpoint.endpointV2
  );

  console.log("🔍 Checking LayerZero's official libraries on Base Sepolia\n");
  console.log("Endpoint:", baseEndpoint.endpointV2);

  // Check default send library for some known EIDs
  const knownEids = [1, 101, 102, 30110, 30111]; // Ethereum, BSC, Avalanche, etc.
  
  console.log("\nDefault send libraries for known EIDs:");
  for (const eid of knownEids) {
    try {
      const lib = await endpoint.defaultSendLibrary(eid);
      if (lib !== "0x0000000000000000000000000000000000000000") {
        console.log(`   EID ${eid}: ${lib}`);
      }
    } catch (e) {
      // Skip if not supported
    }
  }

  // Check if Story Aeneid (1315) has a default library
  console.log("\nChecking Story Aeneid (EID 1315)...");
  try {
    const lib = await endpoint.defaultSendLibrary(1315);
    if (lib !== "0x0000000000000000000000000000000000000000") {
      console.log(`   ✅ Default send library found: ${lib}`);
      
      // Check if it supports Story Aeneid
      const sendLib = await hre.ethers.getContractAt("SendUln302", lib);
      try {
        const supported = await sendLib.isSupportedEid(1315);
        console.log(`   ✅ Library supports EID 1315: ${supported}`);
      } catch (e) {
        console.log(`   ⚠️  Cannot check support: ${e.message}`);
      }
    } else {
      console.log("   ❌ No default send library for EID 1315");
      console.log("\n💡 Solution: Use our deployed SendUln302 and configure via LayerZero dashboard");
      console.log("   Or contact LayerZero to add Story Aeneid support");
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Check our deployed SendUln302
  const ourSendUln = baseEndpoint.sendUln302 || "0x1f860C493FdF423187D31673E5338C1276b6F630";
  if (ourSendUln && ourSendUln !== "0x0000000000000000000000000000000000000000") {
    console.log("\nOur deployed SendUln302:", ourSendUln);
    try {
      const sendLib = await hre.ethers.getContractAt("SendUln302", ourSendUln);
      const supported = await sendLib.isSupportedEid(1315);
      console.log(`   Supports EID 1315: ${supported}`);
    } catch (e) {
      console.log(`   Error checking: ${e.message}`);
    }
  }
}

main().catch(console.error);
