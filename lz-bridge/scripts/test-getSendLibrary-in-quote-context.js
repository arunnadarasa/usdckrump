/**
 * Test if getSendLibrary() behaves differently when called in quote() context
 * Maybe there's a storage read issue during internal calls
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

  console.log("🔍 Testing getSendLibrary() in quote() context\n");

  const testSender = signer.address;
  const dstEid = 1315;

  // Test 1: External call
  console.log("1. External getSendLibrary() call:");
  try {
    const lib1 = await endpoint.getSendLibrary(testSender, dstEid);
    logDebug(runId, "N", "test-getSendLibrary-in-quote-context.js:40", "External getSendLibrary", {
      lib: lib1,
      isZero: lib1 === "0x0000000000000000000000000000000000000000"
    });
    console.log("   Result:", lib1);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 2: Try to simulate quote() by calling getSendLibrary() multiple times
  // and checking if something changes
  console.log("\n2. Testing getSendLibrary() multiple times:");
  for (let i = 0; i < 5; i++) {
    try {
      const lib = await endpoint.getSendLibrary(testSender, dstEid);
      logDebug(runId, "N", "test-getSendLibrary-in-quote-context.js:55", `getSendLibrary call ${i}`, {
        callNumber: i,
        lib,
        isZero: lib === "0x0000000000000000000000000000000000000000"
      });
      if (lib === "0x0000000000000000000000000000000000000000") {
        console.log(`   Call ${i + 1}: ❌ Returns zero!`);
        break;
      }
    } catch (e) {
      console.log(`   Call ${i + 1}: Error - ${e.message}`);
    }
  }

  // Test 3: Check if the issue is with the sender address
  // Maybe quote() uses msg.sender instead of _sender parameter?
  console.log("\n3. Checking if msg.sender vs _sender matters:");
  console.log("   In quote(), _sender parameter is:", testSender);
  console.log("   But quote() is external, so msg.sender would be:", "caller address");
  console.log("   Let's test with different sender addresses");

  // Test with endpoint address as sender (what if quote() checks msg.sender?)
  try {
    const lib2 = await endpoint.getSendLibrary(ownEndpoint.endpointV2, dstEid);
    console.log("   getSendLibrary(endpoint, 1315):", lib2);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 4: Check storage directly during quote() execution
  // We can't easily do this, but we can check if there's a pattern
  console.log("\n4. Testing quote() and checking getSendLibrary() immediately after:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    logDebug(runId, "N", "test-getSendLibrary-in-quote-context.js:90", "Before quote()", {
      sender: testSender
    });
    
    await endpoint.quote(messagingParams, testSender);
    console.log("   ✅ quote() succeeded (unexpected)");
  } catch (e) {
    logDebug(runId, "N", "test-getSendLibrary-in-quote-context.js:98", "quote() failed", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
    
    console.log("   ❌ quote() failed as expected");
    
    // Immediately check getSendLibrary() after the error
    try {
      const lib3 = await endpoint.getSendLibrary(testSender, dstEid);
      logDebug(runId, "N", "test-getSendLibrary-in-quote-context.js:108", "After quote() error", {
        lib: lib3,
        stillWorks: lib3 !== "0x0000000000000000000000000000000000000000"
      });
      console.log("   getSendLibrary() after error:", lib3);
      console.log("   Still works:", lib3 !== "0x0000000000000000000000000000000000000000" ? "✅" : "❌");
    } catch (e2) {
      console.log("   getSendLibrary() also fails after error:", e2.message);
    }
  }

  console.log("\n📋 Test complete. Check logs for details.");
}

main().catch(console.error);
