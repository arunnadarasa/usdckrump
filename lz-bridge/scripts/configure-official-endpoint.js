/**
 * Configure the OFFICIAL LayerZero EndpointV2 for Story Aeneid
 * Set default send library and other configurations
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

  console.log("🔧 Configuring Official LayerZero EndpointV2 for Story Aeneid\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_RECEIVE_ULN = "0x12523de19dc41c91F7d2093E0CFbB76b17012C8d";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const sendUln = await hre.ethers.getContractAt("SendUln302", OFFICIAL_SEND_ULN);
  const dstEid = 1315; // Story Aeneid

  console.log("1. Checking if we can set default send library:");
  try {
    // Check if we're the owner
    const owner = await endpoint.owner();
    console.log("   Endpoint owner:", owner);
    console.log("   Our address:", signer.address);
    const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we owner?", isOwner ? "✅ YES" : "❌ NO");
    
    if (!isOwner) {
      console.log("\n   ⚠️  Cannot configure - we're not the owner!");
      console.log("   The official endpoint is owned by LayerZero Labs.");
      console.log("   We need to use setSendLibrary() per-OApp instead.");
      logDebug(runId, "GG", "configure-official-endpoint.js:65", "Not owner of official endpoint", {
        owner,
        ourAddress: signer.address,
        solution: "Use setSendLibrary() per-OApp instead of defaultSendLibrary"
      });
    } else {
      // Try to set default send library
      console.log("\n2. Setting default send library for Story Aeneid:");
      const tx = await endpoint.setDefaultSendLibrary(dstEid, OFFICIAL_SEND_ULN);
      await tx.wait();
      console.log("   ✅ Default send library set");
      logDebug(runId, "GG", "configure-official-endpoint.js:75", "Default send library set", {
        dstEid,
        sendLibrary: OFFICIAL_SEND_ULN
      });
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "GG", "configure-official-endpoint.js:82", "Error setting default", {
      error: e.message
    });
  }

  // Try setting send library per-OApp (this should work even if we're not owner)
  console.log("\n3. Setting send library per-OApp:");
  try {
    const tx = await endpoint.setSendLibrary(signer.address, dstEid, OFFICIAL_SEND_ULN);
    await tx.wait();
    console.log("   ✅ Send library set for our address");
    logDebug(runId, "GG", "configure-official-endpoint.js:92", "Send library set per-OApp", {
      oapp: signer.address,
      dstEid,
      sendLibrary: OFFICIAL_SEND_ULN
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "GG", "configure-official-endpoint.js:99", "Error setting send library", {
      error: e.message
    });
  }

  // Test quote() after configuration
  console.log("\n4. Testing quote() after configuration:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "GG", "configure-official-endpoint.js:115", "Before quote() test", {
    endpoint: OFFICIAL_ENDPOINT
  });

  try {
    const fee = await endpoint.quote(messagingParams, signer.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Using self-deployed endpoint instead of official LayerZero EndpointV2");
    console.log("   Solution: Use official EndpointV2 and configure Story Aeneid");
    logDebug(runId, "GG", "configure-official-endpoint.js:127", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Using official endpoint and configuring Story Aeneid fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "GG", "configure-official-endpoint.js:136", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
