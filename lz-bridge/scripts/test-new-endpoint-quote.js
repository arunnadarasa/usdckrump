/**
 * Test if the newly deployed EndpointV2 fixes the quote() bug
 * This tests quote() directly on the new endpoint
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
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const runId = `run_${Date.now()}`;

  console.log("🧪 Testing New EndpointV2 quote() Function\n");
  console.log("New EndpointV2:", ownEndpoint.endpointV2);
  console.log("Compiler settings: optimizer runs=1 (minimal optimization)\n");

  const oapp = baseOft.address;
  const eid = 1315;

  // Test 1: External getSendLibrary() call
  console.log("1. Testing external getSendLibrary() call:");
  try {
    const lib = await endpoint.getSendLibrary(oapp, eid);
    logDebug(runId, "K", "test-new-endpoint-quote.js:45", "External getSendLibrary", {
      lib,
      isZero: lib === "0x0000000000000000000000000000000000000000"
    });
    console.log("   Result:", lib);
    console.log("   Is zero:", lib === "0x0000000000000000000000000000000000000000");
    
    if (lib === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  Library not set yet - need to configure");
      console.log("   This is expected for a new endpoint");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 2: Set default send library first
  console.log("\n2. Setting default send library:");
  try {
    const sendUln = ownEndpoint.sendUln302;
    const tx = await endpoint.setDefaultSendLibrary(eid, sendUln);
    await tx.wait();
    console.log("   ✅ Default send library set:", sendUln);
    
    // Verify
    const defaultLib = await endpoint.defaultSendLibrary(eid);
    console.log("   Verified:", defaultLib);
    logDebug(runId, "K", "test-new-endpoint-quote.js:70", "Default send library set", {
      defaultLib,
      expected: sendUln,
      match: defaultLib.toLowerCase() === sendUln.toLowerCase()
    });
  } catch (e) {
    console.log("   Error:", e.message);
    if (e.data) console.log("   Error data:", e.data);
  }

  // Test 3: Now test quote() with default library
  console.log("\n3. Testing quote() with default library:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: eid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    logDebug(runId, "K", "test-new-endpoint-quote.js:90", "Before quote() call", {
      sender: oapp,
      dstEid: eid
    });
    
    const fee = await endpoint.quote(messagingParams, oapp);
    
    logDebug(runId, "K", "test-new-endpoint-quote.js:97", "quote() succeeded", {
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      success: true
    });
    
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED! Minimal optimization (1 run) resolves the issue!");
  } catch (e) {
    logDebug(runId, "K", "test-new-endpoint-quote.js:110", "quote() failed", {
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
        console.log("   This is still LZ_DefaultSendLibUnavailable()");
        console.log("   Bug persists even with minimal optimization");
      }
    }
  }

  console.log("\n📋 Test complete. Check logs for details.");
}

main().catch(console.error);
