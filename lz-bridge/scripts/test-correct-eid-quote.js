/**
 * Test quote() on endpoint with CORRECT LayerZero EID (40245)
 * This should fix the LZ_DefaultSendLibUnavailable error
 */
const hre = require("hardhat");
const fs = require("fs");

const LOG_PATH = "/Users/openclaw/Documents/USDC Krump/.cursor/debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154";

function logDebug(runId, hypothesisId, location, message, data) {
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    location,
    message,
    data,
    runId,
    hypothesisId
  };
  
  fs.appendFileSync(LOG_PATH, JSON.stringify(logEntry) + "\n");
  
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry)
  }).catch(() => {});
}

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const runId = `run_${Date.now()}`;

  console.log("🧪 Testing EndpointV2 with CORRECT LayerZero EID\n");
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("Endpoint EID:", (await endpoint.eid()).toString());
  console.log("Expected EID: 40245\n");

  // Verify EID is correct
  const eid = await endpoint.eid();
  if (eid !== 40245n) {
    console.error("❌ Endpoint EID is wrong! Expected 40245, got:", eid.toString());
    process.exit(1);
  }

  // Configure default send library for Story Aeneid (EID 1315)
  console.log("1. Setting default send library for Story Aeneid (EID 1315):");
  try {
    const sendUln = ownEndpoint.sendUln302;
    const tx = await endpoint.setDefaultSendLibrary(1315, sendUln);
    await tx.wait();
    console.log("   ✅ Default send library set:", sendUln);
    
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    logDebug(runId, "L", "test-correct-eid-quote.js:50", "Default send library set", {
      eid: 1315,
      defaultLib,
      expected: sendUln,
      match: defaultLib.toLowerCase() === sendUln.toLowerCase()
    });
    console.log("   Verified:", defaultLib);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test quote() with Story Aeneid (EID 1315)
  console.log("\n2. Testing quote() with Story Aeneid (EID 1315):");
  const testSender = signer.address; // Use signer as test sender
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  
  const messagingParams = {
    dstEid: 1315, // Story Aeneid
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    logDebug(runId, "L", "test-correct-eid-quote.js:75", "Before quote() call", {
      endpointEid: eid.toString(),
      dstEid: 1315,
      sender: testSender
    });
    
    const fee = await endpoint.quote(messagingParams, testSender);
    
    logDebug(runId, "L", "test-correct-eid-quote.js:83", "quote() succeeded", {
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      success: true,
      fixConfirmed: "Correct EID fixed the bug!"
    });
    
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   The issue was using chain ID (84532) instead of LayerZero EID (40245)");
    console.log("   LayerZero AI was correct - this was NOT a compiler bug!");
  } catch (e) {
    logDebug(runId, "L", "test-correct-eid-quote.js:98", "quote() failed", {
      error: e.message,
      errorData: e.data,
      errorSig: e.data ? e.data.slice(0, 10) : null,
      success: false
    });
    
    console.log("   ❌ quote() still fails:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x6592671c") {
        console.log("   Still LZ_DefaultSendLibUnavailable()");
        console.log("   May need to configure libraries differently");
      }
    }
  }

  console.log("\n📋 Test complete. Check logs for details.");
}

main().catch(console.error);
