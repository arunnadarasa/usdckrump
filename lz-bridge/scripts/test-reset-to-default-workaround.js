/**
 * Test workaround: Reset sendLibrary[oapp][eid] to DEFAULT_LIB
 * This will make getSendLibrary() fall back to defaultSendLibrary[eid]
 * Since defaultSendLibrary is set correctly, this might work around the bug
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔧 Testing Workaround: Reset to DEFAULT_LIB\n");

  const oapp = baseOft.address;
  const eid = 1315;

  // Check current state
  console.log("1. Current state:");
  const currentLib = await endpoint.getSendLibrary(oapp, eid);
  const isDefault = await endpoint.isDefaultSendLibrary(oapp, eid);
  const defaultLib = await endpoint.defaultSendLibrary(eid);
  
  console.log("   getSendLibrary():", currentLib);
  console.log("   isDefaultSendLibrary():", isDefault);
  console.log("   defaultSendLibrary(1315):", defaultLib);
  console.log("   Expected library:", ownEndpoint.sendUln302);

  if (isDefault) {
    console.log("\n   ✅ Already using default library");
    console.log("   But quote() still fails, so this won't help");
    return;
  }

  // Reset to DEFAULT_LIB (address(0))
  console.log("\n2. Resetting sendLibrary to DEFAULT_LIB:");
  console.log("   This will make getSendLibrary() fall back to defaultSendLibrary");
  
  try {
    // Set to address(0) which is DEFAULT_LIB
    const tx = await endpoint.setSendLibrary(oapp, eid, hre.ethers.ZeroAddress);
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed at block:", receipt.blockNumber);
    
    // Verify it's now DEFAULT_LIB
    const isDefaultAfter = await endpoint.isDefaultSendLibrary(oapp, eid);
    console.log("\n3. After reset:");
    console.log("   isDefaultSendLibrary():", isDefaultAfter);
    
    if (isDefaultAfter) {
      // Now getSendLibrary should return defaultSendLibrary
      const libAfter = await endpoint.getSendLibrary(oapp, eid);
      console.log("   getSendLibrary():", libAfter);
      console.log("   Expected (defaultSendLibrary):", defaultLib);
      console.log("   Match:", libAfter.toLowerCase() === defaultLib.toLowerCase());
      
      // Test quote()
      console.log("\n4. Testing quote() after reset:");
      const recipient = hre.ethers.zeroPadValue(deployer.address, 32);
      const messagingParams = {
        dstEid: eid,
        receiver: recipient,
        message: "0x",
        options: "0x",
        payInLzToken: false
      };
      
      try {
        const fee = await endpoint.quote(messagingParams, oapp);
        console.log("   ✅ quote() SUCCEEDED!");
        console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee));
        console.log("\n   🎉 WORKAROUND WORKS!");
        console.log("   The issue is that internal calls can't read sendLibrary[oapp][eid]");
        console.log("   But they CAN read defaultSendLibrary[eid]");
      } catch (e) {
        console.log("   ❌ quote() still fails:", e.message);
        if (e.data) {
          const errorSig = e.data.slice(0, 10);
          console.log("   Error signature:", errorSig);
        }
        console.log("\n   This workaround doesn't help");
      }
    }
  } catch (e) {
    console.log("   ❌ Failed to reset:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x8aea2fe6") {
        console.log("   This is LZ_SameValue - library is already DEFAULT_LIB");
      }
    }
  }

  console.log("\n✅ Test complete");
}

main().catch(console.error);
