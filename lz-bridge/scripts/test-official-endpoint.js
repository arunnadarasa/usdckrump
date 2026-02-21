/**
 * Test quote() with the OFFICIAL LayerZero EndpointV2
 * This should work because the official endpoint has default send libraries configured
 */
const hre = require("hardhat");
const fs = require("fs");

const LOG_PATH = "/Users/openclaw/Documents/USDC Krump/.cursor/debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154";

function logDebug(runId, hypothesisId, location, message, data) {
  const sanitizeData = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(sanitizeData);
    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitizeData(value);
      }
      return result;
    }
    return obj;
  };
  
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    location,
    message,
    data: sanitizeData(data),
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
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing quote() with OFFICIAL LayerZero EndpointV2\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_RECEIVE_ULN = "0x12523de19dc41c91F7d2093E0CFbB76b17012C8d";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  console.log("Official EndpointV2:", OFFICIAL_ENDPOINT);
  console.log("Official SendUln302:", OFFICIAL_SEND_ULN);
  console.log("Official ReceiveUln302:", OFFICIAL_RECEIVE_ULN);
  console.log("Official Executor:", OFFICIAL_EXECUTOR);
  console.log();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const testSender = signer.address;
  const dstEid = 1315; // Story Aeneid
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Check getSendLibrary with official endpoint
  console.log("1. Checking getSendLibrary() with official endpoint:");
  try {
    const lib = await endpoint.getSendLibrary(testSender, dstEid);
    console.log("   Library:", lib);
    console.log("   Expected:", OFFICIAL_SEND_ULN);
    const isMatch = lib.toLowerCase() === OFFICIAL_SEND_ULN.toLowerCase();
    console.log("   Match:", isMatch ? "✅" : "❌");
    logDebug(runId, "FF", "test-official-endpoint.js:60", "getSendLibrary with official endpoint", {
      lib,
      expected: OFFICIAL_SEND_ULN,
      match: isMatch
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "FF", "test-official-endpoint.js:68", "getSendLibrary failed", {
      error: e.message
    });
  }

  // Check defaultSendLibrary
  console.log("\n2. Checking defaultSendLibrary(1315):");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Default library:", defaultLib);
    logDebug(runId, "FF", "test-official-endpoint.js:77", "defaultSendLibrary", {
      lib: defaultLib
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote() with official endpoint
  console.log("\n3. Testing quote() with official endpoint:");
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "FF", "test-official-endpoint.js:90", "Before quote() with official endpoint", {
    endpoint: OFFICIAL_ENDPOINT
  });

  try {
    const fee = await endpoint.quote(messagingParams, testSender);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Using self-deployed endpoint instead of official LayerZero EndpointV2");
    console.log("   Solution: Use official EndpointV2:", OFFICIAL_ENDPOINT);
    logDebug(runId, "FF", "test-official-endpoint.js:103", "Quote succeeded with official endpoint", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Using official LayerZero EndpointV2 fixed the bug!",
      rootCause: "Self-deployed endpoint doesn't have default send libraries configured",
      solution: "Use official LayerZero EndpointV2: " + OFFICIAL_ENDPOINT
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "FF", "test-official-endpoint.js:113", "Quote still fails with official endpoint", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
