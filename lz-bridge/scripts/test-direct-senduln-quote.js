/**
 * Test SendUln302.quote() directly with minimal parameters
 * This will help isolate if the error is from SendUln302 itself or EndpointV2
 */
const hre = require("hardhat");
const fs = require("fs");

const LOG_PATH = "/Users/openclaw/Documents/USDC Krump/.cursor/debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154";

function logDebug(runId, hypothesisId, location, message, data) {
  // Convert BigInt values to strings for JSON serialization
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

  console.log("🔍 Testing SendUln302.quote() Directly\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Build packet
  const nonce = await endpoint.outboundNonce(testSender, dstEid, recipient);
  const srcEid = await endpoint.eid();
  
  const packet = {
    nonce: nonce + 1n,
    srcEid: Number(srcEid),
    sender: testSender,
    dstEid: dstEid,
    receiver: recipient,
    guid: hre.ethers.zeroPadValue("0x", 32),
    message: "0x"
  };

  console.log("Packet:", {
    nonce: packet.nonce.toString(),
    srcEid: packet.srcEid,
    sender: packet.sender,
    dstEid: packet.dstEid,
    receiver: packet.receiver,
    guid: packet.guid,
    message: packet.message
  });
  console.log("\n1. Testing SendUln302.quote() directly:");

  logDebug(runId, "CC", "test-direct-senduln-quote.js:50", "Before SendUln302.quote()", {
    packet,
    options: "0x",
    payInLzToken: false
  });

  try {
    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    logDebug(runId, "CC", "test-direct-senduln-quote.js:61", "SendUln302.quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() FAILED");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", e.message);
    
    if (errorSig === "0x6592671c") {
      console.log("   ⚠️  This is the same error!");
      console.log("   The error originates from SendUln302.quote() itself");
      logDebug(runId, "CC", "test-direct-senduln-quote.js:73", "SendUln302.quote has same error", {
        errorSig,
        confirmed: "Error originates from SendUln302.quote() directly, not EndpointV2"
      });
    } else {
      logDebug(runId, "CC", "test-direct-senduln-quote.js:79", "SendUln302.quote different error", {
        errorSig,
        error: e.message
      });
    }
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
