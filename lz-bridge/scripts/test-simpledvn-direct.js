/**
 * Test SimpleDVN.getFee() directly to verify it works
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
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing SimpleDVN Directly\n");

  // Get DVN address from ULN config
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const ulnConfigBytes = await endpoint.getConfig(signer.address, ownEndpoint.sendUln302, 1315, 2);
  const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    ulnConfigBytes
  )[0];

  if (ulnConfig.optionalDVNs.length === 0) {
    console.log("❌ No DVNs in config");
    return;
  }

  const dvnAddress = ulnConfig.optionalDVNs[0];
  console.log("DVN Address:", dvnAddress);

  // Test SimpleDVN.getFee()
  console.log("\n1. Testing SimpleDVN.getFee():");
  try {
    const dvn = await hre.ethers.getContractAt("SimpleDVN", dvnAddress);
    const fee = await dvn.getFee(1315, 1n, signer.address, "0x");
    console.log("   ✅ SimpleDVN.getFee() works");
    console.log("   Fee:", fee.toString());
    logDebug(runId, "AA", "test-simpledvn-direct.js:55", "SimpleDVN.getFee works", {
      fee: fee.toString(),
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SimpleDVN.getFee() fails:", errorSig);
    console.log("   Error:", e.message);
    
    if (errorSig === "0x6592671c") {
      console.log("   ⚠️  THIS IS THE SAME ERROR!");
      logDebug(runId, "AA", "test-simpledvn-direct.js:65", "SimpleDVN.getFee has same error", {
        errorSig,
        confirmed: "Error originates from SimpleDVN.getFee()"
      });
    } else {
      logDebug(runId, "AA", "test-simpledvn-direct.js:71", "SimpleDVN.getFee different error", {
        errorSig,
        error: e.message
      });
    }
  }

  // Test quote() again
  console.log("\n2. Testing quote() again:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: 1315,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    const fee = await endpoint.quote(messagingParams, signer.address);
    console.log("   ✅ quote() SUCCEEDED!");
    logDebug(runId, "AA", "test-simpledvn-direct.js:90", "Quote succeeded", {
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    logDebug(runId, "AA", "test-simpledvn-direct.js:97", "Quote still fails", {
      errorSig
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
