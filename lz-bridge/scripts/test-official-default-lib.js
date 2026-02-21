/**
 * Test if we can use the official endpoint's default send library
 * even though it doesn't support Story Aeneid
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

  console.log("Testing Official Endpoint Default Library Path\n");

  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const oappAddress = baseOft.address;
  const dstEid = 1315;

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);

  // Hypothesis LL: Official endpoint might allow using default library even if it doesn't support EID
  // We'll check what happens if we DON'T set a custom send library and use the default
  console.log("Hypothesis LL: Official endpoint may allow default library path\n");

  // Check current send library (should be default/zero)
  console.log("1. Checking current send library:");
  try {
    const [currentLib, isDefault] = await endpoint.getSendLibrary(oappAddress, dstEid);
    console.log("   Current library:", currentLib);
    console.log("   Is default?", isDefault);
    logDebug(runId, "LL", "test-official-default-lib.js:60", "Current send library", {
      library: currentLib,
      isDefault
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check default send library for EID 1315
  console.log("\n2. Checking default send library for EID 1315:");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Default library:", defaultLib);
    logDebug(runId, "LL", "test-official-default-lib.js:73", "Default send library", {
      defaultLibrary: defaultLib
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Try quote() without setting custom library (use default)
  console.log("\n3. Testing quote() with default library:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "LL", "test-official-default-lib.js:90", "Before quote() with default library", {
    endpoint: OFFICIAL_ENDPOINT,
    oapp: oappAddress
  });

  try {
    const fee = await endpoint.quote(messagingParams, oappAddress);
    console.log("   ✅ quote() SUCCEEDED with default library!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 SOLUTION FOUND!");
    console.log("   We don't need to set a custom send library!");
    console.log("   The default library path works (even if it doesn't support Story Aeneid)");
    logDebug(runId, "LL", "test-official-default-lib.js:105", "Quote succeeded with default", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      solution: "Use default library path, no custom library needed!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "LL", "test-official-default-lib.js:114", "Quote fails with default", {
      errorSig,
      error: e.message,
      success: false
    });
    
    // Hypothesis MM: Maybe we need to register our library first, or use a different approach
    console.log("\n   💡 Alternative: We may need LayerZero to register our SendUln302");
    console.log("   Or configure Story Aeneid through LayerZero's official channels");
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
