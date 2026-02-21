/**
 * Check treasury configuration on SendUln302
 * Hypothesis ZZ: Treasury might not be set and causing the error
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

  console.log("🔍 Checking Treasury Configuration\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  console.log("1. Checking treasury:");
  try {
    const treasury = await sendUln.treasury();
    console.log("   Treasury:", treasury);
    console.log("   Is zero?", treasury === hre.ethers.ZeroAddress ? "✅ YES (OK - treasury is optional)" : "❌ NO");
    logDebug(runId, "ZZ", "check-treasury-config.js:50", "Treasury check", {
      treasury,
      isZero: treasury === hre.ethers.ZeroAddress
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Try to decode error 0x6592671c by checking common error signatures
  console.log("\n2. Attempting to decode error 0x6592671c:");
  const errorSig = "0x6592671c";
  
  // Common LayerZero errors
  const commonErrors = [
    "error LZ_DefaultSendLibUnavailable()",
    "error LZ_DefaultReceiveLibUnavailable()",
    "error LZ_ULN_UnsupportedEid(uint32)",
    "error LZ_ULN_AtLeastOneDVN()",
    "error LZ_MessageLib_InvalidExecutor()",
    "error LZ_MessageLib_InvalidMessageSize(uint256,uint32)",
    "error LZ_MessageLib_ZeroMessageSize()",
    "error LZ_MessageLib_InvalidAmount(uint256,uint256)",
    "error LZ_MessageLib_TransferFailed()"
  ];

  const iface = new hre.ethers.Interface(commonErrors);
  try {
    const decoded = iface.parseError(errorSig);
    console.log("   ✅ Decoded:", decoded.name, decoded.args);
    logDebug(runId, "ZZ", "check-treasury-config.js:75", "Error decoded", {
      errorName: decoded.name,
      args: decoded.args
    });
  } catch (e) {
    console.log("   ❌ Could not decode with common errors");
    console.log("   This is an unknown custom error");
    logDebug(runId, "ZZ", "check-treasury-config.js:81", "Error not decodable", {
      errorSig
    });
  }

  console.log("\n✅ Check complete. Check logs for details.");
}

main().catch(console.error);
