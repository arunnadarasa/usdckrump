/**
 * Test _isSupportedEid() check - maybe this is where the error comes from?
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
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing isSupportedEid() Check\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const dstEid = 1315;

  console.log("1. Testing isSupportedEid(1315):");
  try {
    const isSupported = await sendUln.isSupportedEid(dstEid);
    console.log("   Result:", isSupported);
    logDebug(runId, "DD", "test-is-supported-eid.js:55", "isSupportedEid check", {
      eid: dstEid,
      isSupported
    });
    
    if (!isSupported) {
      console.log("   ⚠️  EID 1315 is NOT supported!");
      console.log("   This could cause the error!");
    } else {
      console.log("   ✅ EID 1315 is supported");
    }
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ isSupportedEid() fails:", errorSig);
    logDebug(runId, "DD", "test-is-supported-eid.js:68", "isSupportedEid failed", {
      errorSig,
      error: e.message
    });
  }

  // Check default ULN config to see if it would pass _isSupportedEid
  console.log("\n2. Checking default ULN config for EID 1315:");
  try {
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    const configBytes = await endpoint.getConfig(
      "0x0000000000000000000000000000000000000000",
      ownEndpoint.sendUln302,
      dstEid,
      2
    );
    const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      configBytes
    )[0];
    
    console.log("   Required DVN count:", config.requiredDVNCount.toString());
    console.log("   Optional DVN threshold:", config.optionalDVNThreshold.toString());
    
    // _isSupportedEid checks: requiredDVNCount > 0 || optionalDVNThreshold > 0
    const wouldPass = config.requiredDVNCount > 0 || config.optionalDVNThreshold > 0;
    console.log("   Would pass _isSupportedEid():", wouldPass ? "✅" : "❌");
    
    logDebug(runId, "DD", "test-is-supported-eid.js:95", "Default ULN config check", {
      requiredDVNCount: config.requiredDVNCount.toString(),
      optionalDVNThreshold: config.optionalDVNThreshold.toString(),
      wouldPass
    });
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
