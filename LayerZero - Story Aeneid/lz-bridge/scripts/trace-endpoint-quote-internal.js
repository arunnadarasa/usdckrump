/**
 * Trace EndpointV2.quote() to see what getSendLibrary() returns internally
 * Hypothesis AAA: getSendLibrary() might return zero address when called internally
 * Hypothesis BBB: The error might be from getSendLibrary() validation
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

  console.log("🔍 Tracing EndpointV2.quote() Internal Calls\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Hypothesis AAA: Check what getSendLibrary() returns externally vs what quote() sees internally
  console.log("1. Checking getSendLibrary() externally:");
  try {
    const [lib, isDefault] = await endpoint.getSendLibrary(baseOft.address, dstEid);
    console.log("   Library:", lib);
    console.log("   Is default:", isDefault);
    logDebug(runId, "AAA", "trace-endpoint-quote-internal.js:60", "getSendLibrary external", {
      library: lib,
      isDefault
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check default send library
  console.log("\n2. Checking defaultSendLibrary():");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Default library:", defaultLib);
    logDebug(runId, "AAA", "trace-endpoint-quote-internal.js:72", "defaultSendLibrary", {
      defaultLibrary: defaultLib
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check if send library is registered
  console.log("\n3. Checking if send library is registered:");
  try {
    const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
    console.log("   Is registered?", isRegistered ? "✅ YES" : "❌ NO");
    logDebug(runId, "AAA", "trace-endpoint-quote-internal.js:84", "Library registration", {
      isRegistered,
      library: ownEndpoint.sendUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Try calling quote() with detailed error handling
  console.log("\n4. Calling quote() with detailed error analysis:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "BBB", "trace-endpoint-quote-internal.js:100", "Before quote() call", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address,
    dstEid
  });

  try {
    // Use static call to get more details
    const fee = await endpoint.quote.staticCall(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "BBB", "trace-endpoint-quote-internal.js:111", "Quote succeeded", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    const errorData = e.data || "no data";
    
    console.log("   ❌ quote() failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error data length:", errorData.length);
    
    // Try to decode with all known errors
    const allErrors = [
      "error LZ_DefaultSendLibUnavailable()",
      "error LZ_DefaultReceiveLibUnavailable()",
      "error LZ_ULN_UnsupportedEid(uint32)",
      "error LZ_ULN_AtLeastOneDVN()",
      "error LZ_MessageLib_InvalidExecutor()",
      "error LZ_MessageLib_InvalidMessageSize(uint256,uint32)",
      "error LZ_MessageLib_ZeroMessageSize()",
      "error LZ_MessageLib_InvalidAmount(uint256,uint256)",
      "error LZ_MessageLib_TransferFailed()",
      "error LZ_LzTokenUnavailable()",
      "error LZ_Unauthorized()",
      "error LZ_UnsupportedEid()"
    ];
    
    const iface = new hre.ethers.Interface(allErrors);
    try {
      const decoded = iface.parseError(errorSig);
      console.log("   ✅ Decoded error:", decoded.name, decoded.args);
      logDebug(runId, "BBB", "trace-endpoint-quote-internal.js:135", "Error decoded", {
        errorName: decoded.name,
        args: decoded.args
      });
    } catch (decodeError) {
      console.log("   ❌ Could not decode error");
      console.log("   This is an unknown custom error");
      logDebug(runId, "BBB", "trace-endpoint-quote-internal.js:142", "Error not decodable", {
        errorSig,
        errorData: errorData.slice(0, 100) // First 100 chars
      });
    }
  }

  // Check if the issue is with the packet construction
  console.log("\n5. Checking packet construction:");
  try {
    const nonce = await endpoint.outboundNonce(baseOft.address, dstEid, recipient);
    console.log("   Current nonce:", nonce.toString());
    const nextNonce = nonce + 1n;
    console.log("   Next nonce:", nextNonce.toString());
    
    const eid = await endpoint.eid();
    console.log("   Source EID:", eid.toString());
    console.log("   Destination EID:", dstEid);
    
    logDebug(runId, "BBB", "trace-endpoint-quote-internal.js:162", "Packet info", {
      nonce: nonce.toString(),
      srcEid: eid.toString(),
      dstEid
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  console.log("\n✅ Trace complete. Check logs for details.");
}

main().catch(console.error);
