/**
 * Verify library configuration and EID support
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", ownEndpoint.receiveUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Verifying Library Configuration\n");
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("ReceiveUln302:", ownEndpoint.receiveUln302);
  console.log("Endpoint:", ownEndpoint.endpointV2, "\n");

  // Check EID support
  console.log("EID Support:");
  const sendSupports = await sendUln.isSupportedEid(1315);
  const receiveSupports = await receiveUln.isSupportedEid(1315);
  console.log("   SendUln302 supports EID 1315:", sendSupports);
  console.log("   ReceiveUln302 supports EID 1315:", receiveSupports, "\n");

  // Check registration
  console.log("Registration:");
  const sendRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  const receiveRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.receiveUln302);
  console.log("   SendUln302 registered:", sendRegistered);
  console.log("   ReceiveUln302 registered:", receiveRegistered, "\n");

  // Check default libraries
  console.log("Default Libraries (EID 1315):");
  try {
    const defaultSend = await endpoint.defaultSendLibrary(1315);
    const defaultReceive = await endpoint.defaultReceiveLibrary(1315);
    console.log("   Default send:", defaultSend);
    console.log("   Default receive:", defaultReceive);
  } catch (e) {
    console.log("   Error:", e.message);
  }
}

main().catch(console.error);
