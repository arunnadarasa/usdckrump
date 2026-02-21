/**
 * Deep dive into send library issue - check all conditions
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  console.log("🔬 Deep Dive: Send Library Issue");
  console.log("=".repeat(60));
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // Check all prerequisites
  console.log("1. Prerequisites Check:");
  
  // 1.1 SendUln302 supports EID 1315
  const supportsEid = await sendUln.isSupportedEid(1315);
  console.log("   SendUln302 supports EID 1315:", supportsEid ? "✅" : "❌");
  
  // 1.2 SendUln302 is registered
  const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  console.log("   SendUln302 registered:", isRegistered ? "✅" : "❌");
  
  // 1.3 Default send library is set
  const defaultSend = await endpoint.defaultSendLibrary(1315);
  console.log("   Default send library:", defaultSend);
  console.log("   Expected:", ownEndpoint.sendUln302);
  console.log("   Match:", defaultSend.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  
  // 1.4 Delegate check
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("   OApp delegate:", delegate);
  console.log("   Deployer:", deployer.address);
  console.log("   Match:", delegate.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌\n");

  if (!supportsEid || !isRegistered || defaultSend === "0x0000000000000000000000000000000000000000") {
    console.log("❌ Prerequisites not met!");
    return;
  }

  // Check current state
  console.log("2. Current State:");
  const [currentLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  console.log("   getSendLibrary():", currentLib);
  console.log("   isDefaultSendLibrary():", isDefault);
  console.log("   This is contradictory if lib==0 and isDefault==false\n");

  // Try to simulate what setSendLibrary does
  console.log("3. Simulating setSendLibrary checks:");
  
  // The function checks:
  // - onlyRegisteredOrDefault(_newLib) - library must be registered or DEFAULT_LIB
  // - isSendLib(_newLib) - must be a send library
  // - onlySupportedEid(_newLib, _eid) - library must support the EID
  // - _assertAuthorized(_oapp) - caller must be OApp or delegate
  
  console.log("   Checking onlyRegisteredOrDefault...");
  const libToSet = ownEndpoint.sendUln302;
  const isLibRegistered = await endpoint.isRegisteredLibrary(libToSet);
  console.log("   Library registered:", isLibRegistered ? "✅" : "❌");
  
  console.log("   Checking onlySupportedEid...");
  const libSupportsEid = await sendUln.isSupportedEid(1315);
  console.log("   Library supports EID:", libSupportsEid ? "✅" : "❌");
  
  console.log("   Checking _assertAuthorized...");
  const isAuthorized = delegate.toLowerCase() === deployer.address.toLowerCase();
  console.log("   Authorized:", isAuthorized ? "✅" : "❌\n");

  // Try setting with a static call first to see the error
  console.log("4. Testing setSendLibrary with static call...");
  try {
    // Use callStatic to simulate without actually executing
    await endpoint.setSendLibrary.staticCall(baseOft.address, 1315, libToSet);
    console.log("   ✅ Static call succeeded - should work!\n");
  } catch (e) {
    console.log("   ❌ Static call failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()",
        "error LZ_Unauthorized()",
        "error LZ_UnsupportedEid()",
        "error LZ_OnlyRegisteredOrDefaultLib()",
        "error LZ_OnlySendLib()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded:", decoded.name);
      } catch {}
    }
    console.log();
  }

  // If static call works, try actual transaction
  if (isAuthorized && isLibRegistered && libSupportsEid) {
    console.log("5. Attempting actual transaction...");
    try {
      // Use estimateGas first to see if it would work
      const gasEstimate = await endpoint.setSendLibrary.estimateGas(baseOft.address, 1315, libToSet);
      console.log("   Gas estimate:", gasEstimate.toString());
      console.log("   ✅ Gas estimation succeeded\n");
      
      // Now try the actual transaction
      const tx = await endpoint.setSendLibrary(baseOft.address, 1315, libToSet, {
        gasLimit: gasEstimate * 2n // Use 2x for safety
      });
      console.log("   Transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("   ✅ Transaction confirmed!");
      console.log("   Block:", receipt.blockNumber);
      
      // Verify after
      await new Promise(resolve => setTimeout(resolve, 2000));
      const [newLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
      console.log("   New library:", newLib);
      console.log("   Expected:", libToSet);
      console.log("   Match:", newLib.toLowerCase() === libToSet.toLowerCase() ? "✅" : "❌");
      
    } catch (e) {
      console.log("   ❌ Transaction failed:", e.message);
      if (e.reason) console.log("   Reason:", e.reason);
      if (e.data) {
        console.log("   Error data:", e.data);
        const errorInterface = new hre.ethers.Interface([
          "error LZ_SameValue()",
          "error LZ_Unauthorized()",
          "error LZ_UnsupportedEid()"
        ]);
        try {
          const decoded = errorInterface.parseError(e.data);
          console.log("   Decoded:", decoded.name);
        } catch {}
      }
    }
  }
}

main().catch(console.error);
