/**
 * Test getSendLibrary() behavior - it should fall back to default
 * Hypothesis EEE: getSendLibrary() might be reverting internally even though default is set
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

  console.log("🔍 Testing getSendLibrary() Behavior\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Check what getSendLibrary actually returns
  console.log("1. Testing getSendLibrary() return value:");
  try {
    // The function returns (address lib) - single value, not tuple
    const lib = await endpoint.getSendLibrary(baseOft.address, dstEid);
    console.log("   Library:", lib);
    console.log("   Is zero?", lib === hre.ethers.ZeroAddress ? "✅ YES" : "❌ NO");
    console.log("   Expected:", ownEndpoint.sendUln302);
    const matches = lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase();
    console.log("   Matches expected?", matches ? "✅ YES" : "❌ NO");
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:60", "getSendLibrary result", {
      library: lib,
      expected: ownEndpoint.sendUln302,
      matches
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ getSendLibrary() REVERTED!");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:70", "getSendLibrary reverted", {
      errorSig,
      error: e.message
    });
  }

  // Check isDefaultSendLibrary
  console.log("\n2. Checking isDefaultSendLibrary():");
  try {
    const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, dstEid);
    console.log("   Is default?", isDefault ? "✅ YES" : "❌ NO");
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:80", "isDefaultSendLibrary", {
      isDefault
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check default send library
  console.log("\n3. Checking defaultSendLibrary():");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Default library:", defaultLib);
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:91", "defaultSendLibrary", {
      defaultLibrary: defaultLib
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // If getSendLibrary returns zero, try calling SendUln302.quote() directly with the default library
  console.log("\n4. Testing SendUln302.quote() directly:");
  try {
    const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
    const eid = await endpoint.eid();
    
    const packet = {
      nonce: 1,
      srcEid: Number(eid),
      sender: hre.ethers.zeroPadValue(baseOft.address, 32),
      dstEid: dstEid,
      receiver: hre.ethers.zeroPadValue(signer.address, 32),
      guid: hre.ethers.zeroHash, // Simplified
      message: "0x"
    };

    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:112", "Before SendUln302.quote()", {
      packet
    });

    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:120", "SendUln302.quote() works", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "EEE", "test-getSendLibrary-behavior.js:127", "SendUln302.quote() failed", {
      errorSig,
      error: e.message
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
