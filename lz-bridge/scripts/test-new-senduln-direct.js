/**
 * Test new SendUln302.quote() directly to see if it has the same error
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

// GUID.generate implementation
function generateGUID(nonce, srcEid, sender, dstEid, receiver) {
  return hre.ethers.solidityPackedKeccak256(
    ["uint64", "uint32", "address", "uint32", "bytes32"],
    [nonce, srcEid, sender, dstEid, receiver]
  );
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing New SendUln302.quote() Directly\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;
  const sender = baseOft.address;
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Get packet parameters
  const eid = await endpoint.eid();
  const nonce = await endpoint.outboundNonce(sender, dstEid, recipient);
  const nextNonce = nonce + 1n;
  const guid = generateGUID(nextNonce, Number(eid), sender, dstEid, recipient);

  const packet = {
    nonce: nextNonce,
    srcEid: Number(eid),
    sender: sender,
    dstEid: dstEid,
    receiver: recipient,
    guid: guid,
    message: "0x"
  };

  console.log("1. Testing new SendUln302.quote() directly:");
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  logDebug(runId, "OOO", "test-new-senduln-direct.js:85", "Before SendUln302.quote()", {
    sendUln: ownEndpoint.sendUln302,
    packet
  });

  try {
    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("\n   🎉 NEW SendUln302 WORKS!");
    logDebug(runId, "OOO", "test-new-senduln-direct.js:95", "SendUln302.quote() success", {
      nativeFee: fee.nativeFee.toString(),
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    if (e.data && e.data.length > 10) {
      console.log("   Error data:", e.data);
    }
    logDebug(runId, "OOO", "test-new-senduln-direct.js:105", "SendUln302.quote() failed", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 100) : null,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
