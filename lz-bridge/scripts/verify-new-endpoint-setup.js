/**
 * Verify new endpoint setup: libraries registered, default libraries set
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Verifying New Endpoint Setup\n");
  console.log("Endpoint:", ownEndpoint.endpointV2);
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // Check EID
  const eid = await endpoint.eid();
  console.log("1. Endpoint EID:", eid.toString(), eid === 40245n ? "✅" : "❌");
  
  // Check library registration
  console.log("\n2. Library Registration:");
  const sendLibRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  const receiveLibRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.receiveUln302);
  console.log("   SendUln302 registered:", sendLibRegistered ? "✅" : "❌");
  console.log("   ReceiveUln302 registered:", receiveLibRegistered ? "✅" : "❌");
  
  if (!sendLibRegistered) {
    console.log("\n   Registering SendUln302...");
    try {
      const tx = await endpoint.registerLibrary(ownEndpoint.sendUln302);
      await tx.wait();
      console.log("   ✅ SendUln302 registered");
    } catch (e) {
      console.log("   ❌ Failed:", e.message);
    }
  }
  
  if (!receiveLibRegistered) {
    console.log("\n   Registering ReceiveUln302...");
    try {
      const tx = await endpoint.registerLibrary(ownEndpoint.receiveUln302);
      await tx.wait();
      console.log("   ✅ ReceiveUln302 registered");
    } catch (e) {
      console.log("   ❌ Failed:", e.message);
    }
  }
  
  // Check default send library for Story Aeneid (EID 1315)
  console.log("\n3. Default Send Library for Story Aeneid (EID 1315):");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    console.log("   Default library:", defaultLib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", defaultLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (defaultLib === "0x0000000000000000000000000000000000000000") {
      console.log("\n   Setting default send library...");
      const tx = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.sendUln302);
      await tx.wait();
      console.log("   ✅ Default send library set");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }
  
  // Test getSendLibrary
  console.log("\n4. Testing getSendLibrary():");
  const [signer] = await hre.ethers.getSigners();
  try {
    const lib = await endpoint.getSendLibrary(signer.address, 1315);
    console.log("   getSendLibrary(signer, 1315):", lib);
    console.log("   Is zero:", lib === "0x0000000000000000000000000000000000000000" ? "❌" : "✅");
  } catch (e) {
    console.log("   Error:", e.message);
  }
  
  // Test quote()
  console.log("\n5. Testing quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: 1315,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };
  
  try {
    const fee = await endpoint.quote(messagingParams, signer.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
  } catch (e) {
    console.log("   ❌ quote() FAILED:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
  }
  
  console.log("\n✅ Verification complete");
}

main().catch(console.error);
