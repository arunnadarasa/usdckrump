/**
 * Final test - getSendLibrary() works, so test quote() with proper packet structure
 * Hypothesis FFF: The error might be from packet/GUID construction or SendUln302 internal validation
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

  console.log("🔍 Final Quote Test - getSendLibrary() Works!\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Verify getSendLibrary works
  console.log("1. Verifying getSendLibrary():");
  const lib = await endpoint.getSendLibrary(baseOft.address, dstEid);
  console.log("   Library:", lib);
  console.log("   ✅ getSendLibrary() works correctly\n");

  // Test quote() - this should work now
  console.log("2. Testing endpoint.quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "FFF", "final-quote-test.js:70", "Before quote() call", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address,
    sendLibrary: lib
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: getSendLibrary() was working, issue was elsewhere");
    console.log("   Solution: All configurations are correct, quote() now works!");
    logDebug(runId, "FFF", "final-quote-test.js:85", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "quote() works with correct configuration!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    
    // Try to get more error details
    if (e.data && e.data.length > 10) {
      console.log("   Error data:", e.data);
    }
    
    logDebug(runId, "FFF", "final-quote-test.js:99", "Quote still fails", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 200) : null,
      success: false
    });
    
    // Since getSendLibrary works, the error must be from SendUln302.quote()
    console.log("\n   💡 Since getSendLibrary() works, the error must be from SendUln302.quote()");
    console.log("   Error signature 0x6592671c is still unknown");
    console.log("   This suggests a bug in the deployed SendUln302 contract");
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
