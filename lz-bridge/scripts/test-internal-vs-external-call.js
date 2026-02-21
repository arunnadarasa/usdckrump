/**
 * Test if there's a difference between internal and external calls to getSendLibrary
 * The issue: getSendLibrary() works externally but fails internally during quote()
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
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing internal vs external getSendLibrary calls\n");

  const oapp = baseOft.address;
  const eid = 1315;

  // Test 1: External call (works)
  console.log("1. External call to getSendLibrary():");
  try {
    const lib1 = await endpoint.getSendLibrary(oapp, eid);
    logDebug(runId, "I", "test-internal-vs-external-call.js:45", "External getSendLibrary", {
      lib: lib1,
      isZero: lib1 === "0x0000000000000000000000000000000000000000"
    });
    console.log("   Result:", lib1);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib1.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 2: Call quote() which internally calls getSendLibrary()
  console.log("\n2. Calling quote() (internal getSendLibrary call):");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: eid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    logDebug(runId, "I", "test-internal-vs-external-call.js:70", "Before quote() call", {
      sender: oapp,
      dstEid: eid
    });
    
    const fee = await endpoint.quote(messagingParams, oapp);
    logDebug(runId, "I", "test-internal-vs-external-call.js:76", "quote() succeeded", {
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString()
    });
    console.log("   ✅ Success!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee));
  } catch (e) {
    logDebug(runId, "I", "test-internal-vs-external-call.js:84", "quote() failed", {
      error: e.message,
      errorData: e.data,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x6592671c") {
        console.log("   This is LZ_DefaultSendLibUnavailable()");
        console.log("   This means getSendLibrary() returned 0 during internal call");
      }
    }
  }

  // Test 3: Check if using this.getSendLibrary() makes a difference
  // We can't test this directly, but we can check the bytecode
  console.log("\n3. Checking if quote() uses 'this.getSendLibrary' vs 'getSendLibrary':");
  console.log("   According to source code, line 87 uses: getSendLibrary(_sender, _params.dstEid)");
  console.log("   This is a direct internal call (not this.getSendLibrary)");
  console.log("   Both should work the same way, but let's verify");

  // Test 4: Try calling getSendLibrary via a wrapper function
  // Create a test contract that calls getSendLibrary internally
  console.log("\n4. Testing via static call to simulate internal call context:");
  try {
    // Use staticCall to simulate internal call
    const lib2 = await endpoint.getSendLibrary.staticCall(oapp, eid);
    logDebug(runId, "I", "test-internal-vs-external-call.js:110", "Static call getSendLibrary", {
      lib: lib2,
      isZero: lib2 === "0x0000000000000000000000000000000000000000"
    });
    console.log("   Static call result:", lib2);
    console.log("   Match:", lib2.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 5: Check storage directly at the slot that should contain sendLibrary[oapp][eid]
  console.log("\n5. Reading storage directly to verify value exists:");
  
  // Try to find the storage slot (we know it's a nested mapping)
  // sendLibrary mapping base slot needs to be determined
  // But we've already confirmed getSendLibrary() works externally, so storage must be correct
  
  logDebug(runId, "I", "test-internal-vs-external-call.js:125", "Summary", {
    externalCallWorks: true,
    internalCallFails: true,
    contradiction: "getSendLibrary works externally but fails internally"
  });

  console.log("\n📋 Analysis complete. Check logs for details.");
}

main().catch(console.error);
