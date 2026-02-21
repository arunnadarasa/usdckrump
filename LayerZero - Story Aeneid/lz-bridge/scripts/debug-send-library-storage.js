/**
 * Debug send library storage issue
 * Check actual storage and try to fix it
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  console.log("🔍 Debugging Send Library Storage");
  console.log("=".repeat(60));
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // Check current state
  console.log("1. Current State:");
  const [currentLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  const defaultLib = await endpoint.defaultSendLibrary(1315);
  
  console.log("   getSendLibrary():", currentLib);
  console.log("   isDefaultSendLibrary():", isDefault);
  console.log("   defaultSendLibrary():", defaultLib);
  console.log("   Expected:", ownEndpoint.sendUln302);
  
  // The contradiction:
  // - isDefaultSendLibrary returns false (sendLibrary[oapp][eid] != DEFAULT_LIB)
  // - getSendLibrary returns 0 (sendLibrary[oapp][eid] == 0)
  // This means sendLibrary[oapp][eid] is 0 but DEFAULT_LIB is not 0?
  // Or DEFAULT_LIB is 0 but the comparison is failing?
  
  // Check what DEFAULT_LIB actually is
  console.log("\n2. Checking DEFAULT_LIB constant...");
  // DEFAULT_LIB is address(0) in MessageLibManager
  const DEFAULT_LIB = "0x0000000000000000000000000000000000000000";
  console.log("   DEFAULT_LIB:", DEFAULT_LIB);
  console.log("   currentLib:", currentLib);
  console.log("   Are they equal?", currentLib.toLowerCase() === DEFAULT_LIB.toLowerCase() ? "✅" : "❌");
  
  if (currentLib.toLowerCase() === DEFAULT_LIB.toLowerCase() && !isDefault) {
    console.log("\n   ⚠️  Contradiction detected!");
    console.log("   sendLibrary[oapp][eid] is 0, but isDefaultSendLibrary returns false");
    console.log("   This suggests a bug or the storage is in an inconsistent state");
  }
  
  // Try to explicitly set it to the library address
  console.log("\n3. Attempting to set send library explicitly...");
  
  // Check prerequisites
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("   OApp delegate:", delegate);
  console.log("   Deployer:", deployer.address);
  console.log("   Match:", delegate.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌");
  
  if (delegate.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("   ❌ Not delegate, cannot set library");
    return;
  }
  
  // Check if library supports EID
  const supportsEid = await sendUln.isSupportedEid(1315);
  console.log("   SendUln302 supports EID 1315:", supportsEid ? "✅" : "❌");
  
  if (!supportsEid) {
    console.log("   ❌ Library doesn't support EID 1315");
    return;
  }
  
  // Try setting it
  console.log("\n4. Setting send library to:", ownEndpoint.sendUln302);
  try {
    const tx = await endpoint.setSendLibrary(
      baseOft.address,
      1315,
      ownEndpoint.sendUln302,
      { gasLimit: 500000 }
    );
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed at block:", receipt.blockNumber);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check again
    const [newLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const newIsDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    
    console.log("\n5. After setting:");
    console.log("   getSendLibrary():", newLib);
    console.log("   isDefaultSendLibrary():", newIsDefault);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", newLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (newLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n   ✅ Success! Send library is now set correctly");
      
      // Test quoteSend
      console.log("\n6. Testing quoteSend...");
      const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
      const sendParam = {
        dstEid: 1315,
        to: hre.ethers.zeroPadValue(deployer.address, 32),
        amountLD: hre.ethers.parseUnits("0.1", 6),
        minAmountLD: hre.ethers.parseUnits("0.1", 6),
        extraOptions: "0x",
        composeMsg: "0x",
        oftCmd: "0x",
      };
      
      try {
        const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
        console.log("   ✅ quoteSend successful!");
        console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
        console.log("\n🎉 LayerZero V2 is working correctly!");
      } catch (e) {
        console.log("   ❌ quoteSend still fails:", e.message);
        if (e.data) console.log("   Error data:", e.data);
      }
    }
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
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
        if (decoded.name === "LZ_SameValue") {
          console.log("\n   💡 LZ_SameValue means the library is already set to this value");
          console.log("   But getSendLibrary returns 0 - this is the bug!");
        }
      } catch {}
    }
  }
}

main().catch(console.error);
