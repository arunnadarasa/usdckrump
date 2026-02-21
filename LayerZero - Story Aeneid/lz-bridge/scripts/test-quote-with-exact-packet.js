/**
 * Test quote() with exact packet structure as EndpointV2 constructs it
 * Hypothesis KKK: Packet GUID or structure might be causing the error
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

// GUID.generate implementation (from LayerZero)
function generateGUID(nonce, srcEid, sender, dstEid, receiver) {
  return hre.ethers.solidityPackedKeccak256(
    ["uint64", "uint32", "address", "uint32", "bytes32"],
    [nonce, srcEid, sender, dstEid, receiver]
  );
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing quote() with Exact Packet Structure\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;
  const sender = baseOft.address;
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Get exact values as EndpointV2.quote() does
  console.log("1. Getting packet parameters:");
  const eid = await endpoint.eid();
  const nonce = await endpoint.outboundNonce(sender, dstEid, recipient);
  const nextNonce = nonce + 1n;
  
  console.log("   Source EID:", eid.toString());
  console.log("   Current nonce:", nonce.toString());
  console.log("   Next nonce:", nextNonce.toString());
  console.log("   Sender:", sender);
  console.log("   Receiver:", recipient);

  // Generate GUID exactly as EndpointV2 does
  const guid = generateGUID(nextNonce, Number(eid), sender, dstEid, recipient);
  console.log("   GUID:", guid);

  // Construct packet exactly as EndpointV2.quote() does
  const packet = {
    nonce: nextNonce,
    srcEid: Number(eid),
    sender: sender, // address, not bytes32
    dstEid: dstEid,
    receiver: recipient,
    guid: guid,
    message: "0x"
  };

  logDebug(runId, "KKK", "test-quote-with-exact-packet.js:75", "Packet structure", {
    packet
  });

  // Test SendUln302.quote() with exact packet
  console.log("\n2. Testing SendUln302.quote() with exact packet:");
  try {
    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    logDebug(runId, "KKK", "test-quote-with-exact-packet.js:87", "SendUln302.quote() success", {
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : (e.result && e.result.slice(0, 10)) || "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    if (e.data && e.data.length > 10) {
      console.log("   Error data:", e.data);
    }
    logDebug(runId, "KKK", "test-quote-with-exact-packet.js:97", "SendUln302.quote() failed", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 100) : null
    });
  }

  // Test EndpointV2.quote() for comparison
  console.log("\n3. Testing EndpointV2.quote() for comparison:");
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "KKK", "test-quote-with-exact-packet.js:112", "Before EndpointV2.quote()", {
    endpoint: ownEndpoint.endpointV2,
    oapp: sender
  });

  try {
    const fee = await endpoint.quote(messagingParams, sender);
    console.log("   ✅ EndpointV2.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "KKK", "test-quote-with-exact-packet.js:122", "EndpointV2.quote() success", {
      nativeFee: fee.nativeFee.toString(),
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ EndpointV2.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    if (e.data && e.data.length > 10) {
      console.log("   Error data:", e.data);
    }
    logDebug(runId, "KKK", "test-quote-with-exact-packet.js:132", "EndpointV2.quote() failed", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 100) : null,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
