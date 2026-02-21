/**
 * Test quote() after explicitly setting send library for the sender
 * Per LayerZero docs: Libraries should be explicitly set, not rely on defaults
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

  console.log("🧪 Testing with Explicit Library Configuration\n");
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("Endpoint EID:", (await endpoint.eid()).toString());
  console.log("Test sender:", signer.address);
  console.log("Story Aeneid EID: 1315\n");

  const testSender = signer.address;
  const dstEid = 1315;
  const sendLib = ownEndpoint.sendUln302;

  // Step 1: Check current state
  console.log("1. Checking current library configuration:");
  try {
    const currentLib = await endpoint.getSendLibrary(testSender, dstEid);
    const isDefault = await endpoint.isDefaultSendLibrary(testSender, dstEid);
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    
    logDebug(runId, "M", "test-with-explicit-library-set.js:45", "Current state", {
      currentLib,
      isDefault,
      defaultLib,
      expectedLib: sendLib
    });
    
    console.log("   getSendLibrary():", currentLib);
    console.log("   isDefaultSendLibrary():", isDefault);
    console.log("   defaultSendLibrary():", defaultLib);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Step 2: Set send library explicitly for test sender
  console.log("\n2. Setting send library explicitly for test sender:");
  try {
    // Need to set delegate first if not set
    const delegate = await endpoint.delegates(testSender);
    if (delegate === "0x0000000000000000000000000000000000000000") {
      console.log("   Setting delegate...");
      const txDelegate = await endpoint.setDelegate(signer.address);
      await txDelegate.wait();
      console.log("   ✅ Delegate set");
    }
    
    // Now set send library
    console.log("   Setting send library...");
    const tx = await endpoint.setSendLibrary(testSender, dstEid, sendLib);
    await tx.wait();
    console.log("   ✅ Send library set:", sendLib);
    
    logDebug(runId, "M", "test-with-explicit-library-set.js:75", "Library set", {
      sender: testSender,
      dstEid,
      library: sendLib
    });
    
    // Verify
    const newLib = await endpoint.getSendLibrary(testSender, dstEid);
    const newIsDefault = await endpoint.isDefaultSendLibrary(testSender, dstEid);
    console.log("   Verified getSendLibrary():", newLib);
    console.log("   Verified isDefaultSendLibrary():", newIsDefault);
    console.log("   Match:", newLib.toLowerCase() === sendLib.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "M", "test-with-explicit-library-set.js:90", "Set library failed", {
      error: e.message,
      errorData: e.data
    });
  }

  // Step 3: Test quote() with explicit library set
  console.log("\n3. Testing quote() with explicit library:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    logDebug(runId, "M", "test-with-explicit-library-set.js:105", "Before quote()", {
      sender: testSender,
      dstEid
    });
    
    const fee = await endpoint.quote(messagingParams, testSender);
    
    logDebug(runId, "M", "test-with-explicit-library-set.js:112", "quote() succeeded", {
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      success: true,
      fixConfirmed: "Explicit library setting fixed the bug!"
    });
    
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   The issue was: Libraries must be explicitly set, not rely on defaults");
    console.log("   Per LayerZero Integration Checklist: 'Libraries explicitly set (no reliance on defaults)'");
  } catch (e) {
    logDebug(runId, "M", "test-with-explicit-library-set.js:127", "quote() failed", {
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
      }
    }
  }

  console.log("\n📋 Test complete. Check logs for details.");
}

main().catch(console.error);
