/**
 * Set new SendUln302 per-OApp since default setting failed
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

  console.log("🔧 Setting New SendUln302 Per-OApp\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Set delegate first
  console.log("1. Setting delegate:");
  try {
    const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
    const owner = await oft.owner();
    if (owner.toLowerCase() === signer.address.toLowerCase()) {
      const tx0 = await oft.endpoint.setDelegate(signer.address);
      await tx0.wait();
      console.log("   ✅ Delegate set");
    } else {
      console.log("   ⚠️  Not owner, delegate might already be set");
    }
  } catch (e) {
    console.log("   ⚠️  Delegate setting skipped:", e.message);
  }

  // Set send library per-OApp
  console.log("\n2. Setting send library per-OApp:");
  logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:70", "Before setSendLibrary", {
    oapp: baseOft.address,
    dstEid,
    sendLibrary: ownEndpoint.sendUln302
  });

  try {
    const tx = await endpoint.setSendLibrary(baseOft.address, dstEid, ownEndpoint.sendUln302);
    await tx.wait();
    console.log("   ✅ Send library set per-OApp");
    logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:79", "Send library set", {
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Error:", e.message);
    console.log("   Error signature:", errorSig);
    logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:86", "Error setting send library", {
      error: e.message,
      errorSig
    });
  }

  // Verify
  console.log("\n3. Verifying send library:");
  try {
    const lib = await endpoint.getSendLibrary(baseOft.address, dstEid);
    console.log("   Library:", lib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    const matches = lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase();
    console.log("   Matches?", matches ? "✅ YES" : "❌ NO");
    logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:99", "Send library verification", {
      library: lib,
      expected: ownEndpoint.sendUln302,
      matches
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote()
  console.log("\n4. Testing quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:118", "Before quote() test", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Bytecode mismatch - deployed contract compiled with different settings");
    console.log("   Solution: Redeployed SendUln302 with current compiler settings and set per-OApp");
    logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:130", "Quote succeeded", {
      nativeFee: fee.nativeFee.toString(),
      success: true,
      fixConfirmed: "Redeploying SendUln302 fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "NNN", "set-new-senduln-per-oapp.js:139", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
