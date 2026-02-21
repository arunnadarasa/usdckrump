/**
 * Test resolved ULN config - check if it has at least one DVN
 * Hypothesis III: getUlnConfig() might resolve to 0 DVNs when called internally
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

  console.log("🔍 Testing Resolved ULN Config\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const dstEid = 1315;

  // Check default ULN config
  console.log("1. Checking default ULN config:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const defaultConfig = await sendUln.getUlnConfig(DEFAULT_CONFIG, dstEid);
    console.log("   Confirmations:", defaultConfig.confirmations.toString());
    console.log("   Required DVN count:", defaultConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", defaultConfig.optionalDVNCount.toString());
    console.log("   Optional DVN threshold:", defaultConfig.optionalDVNThreshold.toString());
    console.log("   Total DVNs:", (defaultConfig.requiredDVNs.length + defaultConfig.optionalDVNs.length).toString());
    const hasDVNs = (defaultConfig.requiredDVNCount > 0 || defaultConfig.optionalDVNThreshold > 0);
    console.log("   Has at least one DVN?", hasDVNs ? "✅ YES" : "❌ NO");
    logDebug(runId, "III", "test-resolved-uln-config.js:60", "Default ULN config", {
      confirmations: defaultConfig.confirmations.toString(),
      requiredDVNCount: defaultConfig.requiredDVNCount.toString(),
      optionalDVNCount: defaultConfig.optionalDVNCount.toString(),
      optionalDVNThreshold: defaultConfig.optionalDVNThreshold.toString(),
      hasDVNs
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Error:", e.message);
    console.log("   Error signature:", errorSig);
    logDebug(runId, "III", "test-resolved-uln-config.js:71", "Default ULN config error", {
      error: e.message,
      errorSig
    });
  }

  // Check resolved ULN config for OApp
  console.log("\n2. Checking resolved ULN config for OApp:");
  try {
    const resolvedConfig = await sendUln.getUlnConfig(baseOft.address, dstEid);
    console.log("   Confirmations:", resolvedConfig.confirmations.toString());
    console.log("   Required DVN count:", resolvedConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", resolvedConfig.optionalDVNCount.toString());
    console.log("   Optional DVN threshold:", resolvedConfig.optionalDVNThreshold.toString());
    console.log("   Total DVNs:", (resolvedConfig.requiredDVNs.length + resolvedConfig.optionalDVNs.length).toString());
    const hasDVNs = (resolvedConfig.requiredDVNCount > 0 || resolvedConfig.optionalDVNThreshold > 0);
    console.log("   Has at least one DVN?", hasDVNs ? "✅ YES" : "❌ NO");
    
    if (!hasDVNs) {
      console.log("\n   ⚠️  RESOLVED CONFIG HAS 0 DVNs!");
      console.log("   This would cause LZ_ULN_AtLeastOneDVN() error");
      console.log("   But error signature is 0x6592671c, not LZ_ULN_AtLeastOneDVN");
    }
    
    logDebug(runId, "III", "test-resolved-uln-config.js:92", "Resolved ULN config", {
      confirmations: resolvedConfig.confirmations.toString(),
      requiredDVNCount: resolvedConfig.requiredDVNCount.toString(),
      optionalDVNCount: resolvedConfig.optionalDVNCount.toString(),
      optionalDVNThreshold: resolvedConfig.optionalDVNThreshold.toString(),
      hasDVNs
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Error:", e.message);
    console.log("   Error signature:", errorSig);
    
    // Check if it's LZ_ULN_AtLeastOneDVN
    if (errorSig === "0xce2c3751") {
      console.log("   ✅ This is LZ_ULN_AtLeastOneDVN()!");
      console.log("   The resolved config has 0 DVNs");
    } else {
      console.log("   ❌ Different error:", errorSig);
    }
    
    logDebug(runId, "III", "test-resolved-uln-config.js:111", "Resolved ULN config error", {
      error: e.message,
      errorSig,
      isAtLeastOneDVN: errorSig === "0xce2c3751"
    });
  }

  // Check per-OApp config
  console.log("\n3. Checking per-OApp ULN config:");
  try {
    const appConfig = await sendUln.getAppUlnConfig(baseOft.address, dstEid);
    console.log("   Confirmations:", appConfig.confirmations.toString());
    console.log("   Required DVN count:", appConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", appConfig.optionalDVNCount.toString());
    console.log("   Is using default?", appConfig.confirmations === 0n ? "✅ YES" : "❌ NO");
    logDebug(runId, "III", "test-resolved-uln-config.js:125", "Per-OApp ULN config", {
      confirmations: appConfig.confirmations.toString(),
      requiredDVNCount: appConfig.requiredDVNCount.toString(),
      optionalDVNCount: appConfig.optionalDVNCount.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
