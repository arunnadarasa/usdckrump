/**
 * Trace the exact error by checking each step of quote() execution
 * Use static call to see where exactly it fails
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Tracing quote() Error\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const testSender = signer.address;
  const dstEid = 1315;
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Step 1: Check getSendLibrary() result
  console.log("1. Checking getSendLibrary() result:");
  try {
    const lib = await endpoint.getSendLibrary(testSender, dstEid);
    console.log("   ✅ getSendLibrary():", lib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Step 2: Try static call to quote() to see exact revert reason
  console.log("\n2. Attempting static call to trace error:");
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    // Use staticCall to see the exact revert
    const result = await endpoint.quote.staticCall(messagingParams, testSender);
    console.log("   ✅ Static call succeeded (unexpected!)");
    console.log("   Result:", result);
  } catch (e) {
    console.log("   ❌ Static call failed");
    console.log("   Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      
      // Try to decode error
      const errorInterface = new hre.ethers.Interface([
        "error LZ_DefaultSendLibUnavailable()",
        "error LZ_DefaultReceiveLibUnavailable()",
        "error LZ_UnsupportedEid(uint32 eid)",
        "error LZ_MessageLib_InvalidExecutor()"
      ]);
      
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded error:", decoded.name);
        if (decoded.args) console.log("   Args:", decoded.args);
      } catch {}
    }
    
    // Check if error comes from getSendLibrary or from SendUln302
    console.log("\n3. Testing getSendLibrary() during static call context:");
    try {
      // This should work even in static call context
      const lib2 = await endpoint.getSendLibrary.staticCall(testSender, dstEid);
      console.log("   getSendLibrary() in static context:", lib2);
    } catch (e2) {
      console.log("   getSendLibrary() also fails in static context:", e2.message);
      console.log("   This suggests the issue is in getSendLibrary() itself");
    }
  }

  // Step 4: Check if the issue is with how SendUln302 is called
  console.log("\n4. Testing SendUln302.quote() with library address check:");
  try {
    // Build packet
    const nonce = await endpoint.outboundNonce(testSender, dstEid, recipient);
    const srcEid = await endpoint.eid();
    
    const packet = {
      nonce: nonce + 1n,
      srcEid: Number(srcEid),
      sender: testSender,
      dstEid: dstEid,
      receiver: recipient,
      guid: hre.ethers.zeroPadValue("0x", 32),
      message: "0x"
    };
    
    // Check if SendUln302 checks something about the endpoint
    const fee = await sendUln.quote.staticCall(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() static call succeeded");
  } catch (e) {
    console.log("   ❌ SendUln302.quote() static call failed");
    console.log("   Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      console.log("   This confirms the error comes from SendUln302");
    }
  }

  console.log("\n✅ Trace complete");
}

main().catch(console.error);
