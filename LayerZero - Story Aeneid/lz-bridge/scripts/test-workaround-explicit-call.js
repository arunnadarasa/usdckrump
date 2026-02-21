/**
 * Test workaround: Explicitly call getSendLibrary before quote() to see if it helps
 * Also test if we can bypass the issue by using defaultSendLibrary directly
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔧 Testing Workarounds\n");

  const oapp = baseOft.address;
  const eid = 1315;

  // Workaround 1: Check if explicitly calling getSendLibrary first helps
  console.log("1. Workaround: Explicit getSendLibrary() call before quote():");
  try {
    // Call getSendLibrary explicitly
    const lib = await endpoint.getSendLibrary(oapp, eid);
    console.log("   getSendLibrary() result:", lib);
    
    // Immediately call quote()
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);
    const messagingParams = {
      dstEid: eid,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };
    
    const fee = await endpoint.quote(messagingParams, oapp);
    console.log("   ✅ quote() succeeded after explicit getSendLibrary()!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee));
  } catch (e) {
    console.log("   ❌ Still fails:", e.message);
  }

  // Workaround 2: Check if using defaultSendLibrary works
  console.log("\n2. Workaround: Check if defaultSendLibrary works:");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(eid);
    console.log("   defaultSendLibrary(1315):", defaultLib);
    
    if (defaultLib !== "0x0000000000000000000000000000000000000000") {
      console.log("   ✅ Default library is set");
      console.log("   Expected:", ownEndpoint.sendUln302);
      console.log("   Match:", defaultLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
      
      // Try quote() - it should fall back to default if sendLibrary[oapp][eid] is DEFAULT_LIB
      // But we know sendLibrary[oapp][eid] IS set, so it shouldn't fall back
      // Unless... the internal call reads it as DEFAULT_LIB?
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Workaround 3: Check if setting sendLibrary to DEFAULT_LIB and relying on default works
  console.log("\n3. Workaround: Set sendLibrary to DEFAULT_LIB (use default):");
  try {
    // Check current state
    const isDefault = await endpoint.isDefaultSendLibrary(oapp, eid);
    console.log("   isDefaultSendLibrary():", isDefault);
    
    if (!isDefault) {
      console.log("   Current: sendLibrary is set to specific library");
      console.log("   We could try setting it to DEFAULT_LIB to use defaultSendLibrary");
      console.log("   But this might not be the right solution");
    } else {
      console.log("   Current: sendLibrary is DEFAULT_LIB, should use defaultSendLibrary");
      console.log("   But quote() still fails, so defaultSendLibrary might not be accessible internally");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Workaround 4: Check if the issue is address format
  console.log("\n4. Workaround: Test with different address formats:");
  const addressVariants = [
    oapp,
    oapp.toLowerCase(),
    hre.ethers.getAddress(oapp) // Checksummed
  ];
  
  for (const addr of addressVariants) {
    try {
      const lib = await endpoint.getSendLibrary(addr, eid);
      console.log(`   getSendLibrary(${addr.slice(0, 10)}..., 1315):`, lib);
    } catch (e) {
      console.log(`   Error with ${addr.slice(0, 10)}...:`, e.message);
    }
  }

  console.log("\n✅ Workaround tests complete");
  console.log("\n💡 If none of these work, the issue is likely a bug in the LayerZero contract");
  console.log("   Recommendation: Contact LayerZero support with this diagnosis");
}

main().catch(console.error);
