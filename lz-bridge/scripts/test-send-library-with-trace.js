/**
 * Test send library with transaction trace to see revert reason
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Testing Send Library with Trace");
  console.log("=".repeat(60));
  
  // First, let's try to call setSendLibrary with staticCall to see the error
  console.log("1. Testing setSendLibrary with staticCall...");
  try {
    await endpoint.setSendLibrary.staticCall(
      baseOft.address,
      1315,
      ownEndpoint.sendUln302
    );
    console.log("   ✅ Static call succeeded - should work!");
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
        
        if (decoded.name === "LZ_SameValue") {
          console.log("\n   💡 LZ_SameValue means the library is ALREADY set to this value!");
          console.log("   But getSendLibrary returns 0 - this is the bug!");
          console.log("\n   The storage IS set correctly, but getSendLibrary has a bug");
          console.log("   or there's a mismatch between what's stored and what's read");
        }
      } catch {}
    }
  }
  
  // Since LZ_SameValue suggests it's already set, let's check if maybe
  // the issue is that getSendLibrary is reading from the wrong storage slot
  // or there's a view function implementation bug
  
  console.log("\n2. Checking if this is a view function bug...");
  console.log("   If setSendLibrary says 'LZ_SameValue', the storage IS set");
  console.log("   But getSendLibrary returns 0 - this suggests:");
  console.log("   - View function bug");
  console.log("   - Storage slot mismatch");
  console.log("   - Or the library was set but then cleared somehow");
  
  // Let's try calling quote directly on the endpoint with a workaround
  console.log("\n3. Testing endpoint quote with explicit library...");
  // Actually, we can't pass the library directly - the endpoint resolves it internally
  
  // The real test is: does quoteSend work during actual execution?
  // During execution, it uses the actual storage, not view functions
  console.log("\n4. Testing quoteSend (uses actual storage during execution)...");
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
    console.log("\n🎉 LayerZero V2 is working!");
    console.log("   The view function bug doesn't affect actual execution");
  } catch (e) {
    console.log("   ❌ quoteSend failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      console.log("   Selector:", e.data.slice(0, 10));
      
      if (e.data.slice(0, 10).toLowerCase() === "0x6592671c") {
        console.log("\n   💡 Error: LZ_DefaultSendLibUnavailable");
        console.log("   This confirms getSendLibrary returns 0 during execution too");
        console.log("   The storage is NOT actually set, despite LZ_SameValue error");
        console.log("\n   Possible causes:");
        console.log("   - Storage slot collision");
        console.log("   - Library was set but then cleared");
        console.log("   - Different OApp address or EID mismatch");
      }
    }
  }
}

main().catch(console.error);
