/**
 * Reset send library: set to DEFAULT_LIB first, then set to actual library
 * This might fix the storage inconsistency
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔄 Resetting Send Library");
  console.log("=".repeat(60));
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315");
  console.log("Library:", ownEndpoint.sendUln302, "\n");

  // Step 1: Set to DEFAULT_LIB (address(0))
  console.log("Step 1: Setting to DEFAULT_LIB (address(0))...");
  try {
    const tx1 = await endpoint.setSendLibrary(
      baseOft.address,
      1315,
      "0x0000000000000000000000000000000000000000", // DEFAULT_LIB
      { gasLimit: 500000 }
    );
    console.log("   Transaction:", tx1.hash);
    const receipt1 = await tx1.wait();
    console.log("   ✅ Set to DEFAULT_LIB at block:", receipt1.blockNumber);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify it's now DEFAULT_LIB
    const [libAfterReset] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefaultAfterReset = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    console.log("   getSendLibrary() after reset:", libAfterReset);
    console.log("   isDefaultSendLibrary():", isDefaultAfterReset);
    
    if (isDefaultAfterReset) {
      console.log("   ✅ Successfully reset to DEFAULT_LIB");
    } else {
      console.log("   ⚠️  Still not DEFAULT_LIB - might need to wait for more blocks");
    }
    
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()",
        "error LZ_Unauthorized()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded:", decoded.name);
        if (decoded.name === "LZ_SameValue") {
          console.log("   💡 Already DEFAULT_LIB - proceeding to step 2");
        }
      } catch {}
    }
    return;
  }

  // Step 2: Set to actual library
  console.log("\nStep 2: Setting to actual library...");
  try {
    const tx2 = await endpoint.setSendLibrary(
      baseOft.address,
      1315,
      ownEndpoint.sendUln302,
      { gasLimit: 500000 }
    );
    console.log("   Transaction:", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("   ✅ Set to library at block:", receipt2.blockNumber);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify it's now set correctly
    const [libAfterSet] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefaultAfterSet = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    
    console.log("\nStep 3: Verifying final state...");
    console.log("   getSendLibrary():", libAfterSet);
    console.log("   isDefaultSendLibrary():", isDefaultAfterSet);
    console.log("   defaultSendLibrary():", defaultLib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", libAfterSet.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (libAfterSet.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n   🎉 Success! Send library is now correctly set!");
      
      // Test quoteSend
      console.log("\nStep 4: Testing quoteSend...");
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
    } else {
      console.log("\n   ❌ Still not set correctly");
      console.log("   The reset didn't fix the issue");
    }
    
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
    }
  }
}

main().catch(console.error);
