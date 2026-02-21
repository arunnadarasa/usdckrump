/**
 * Test if getUlnConfig() behaves differently when called in quote() context
 * Hypothesis HHH: getUlnConfig() might fail when called with packet.sender vs OApp address
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

  console.log("🔍 Testing ULN Config in Quote Context\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Hypothesis HHH: Check getUlnConfig with different sender addresses
  console.log("1. Testing getUlnConfig() with OApp address:");
  try {
    const ulnConfig = await sendUln.getUlnConfig(baseOft.address, dstEid);
    console.log("   ✅ getUlnConfig() works");
    console.log("   Confirmations:", ulnConfig.confirmations.toString());
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    console.log("   Optional DVNs:", ulnConfig.optionalDVNs.length);
    logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:60", "getUlnConfig with OApp", {
      confirmations: ulnConfig.confirmations.toString(),
      optionalDVNCount: ulnConfig.optionalDVNCount.toString(),
      optionalDVNs: ulnConfig.optionalDVNs
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ getUlnConfig() failed:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:70", "getUlnConfig failed", {
      errorSig,
      error: e.message
    });
  }

  // Check what sender address quote() uses
  console.log("\n2. Checking packet construction:");
  try {
    const eid = await endpoint.eid();
    const nonce = await endpoint.outboundNonce(baseOft.address, dstEid, hre.ethers.zeroPadValue(signer.address, 32));
    console.log("   Source EID:", eid.toString());
    console.log("   Nonce:", nonce.toString());
    console.log("   OApp address:", baseOft.address);
    console.log("   Packet sender should be:", baseOft.address);
    logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:85", "Packet info", {
      srcEid: eid.toString(),
      nonce: nonce.toString(),
      oapp: baseOft.address
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Try calling SendUln302.quote() directly with proper packet
  console.log("\n3. Testing SendUln302.quote() directly:");
  try {
    const eid = await endpoint.eid();
    const nonce = await endpoint.outboundNonce(baseOft.address, dstEid, hre.ethers.zeroPadValue(signer.address, 32));
    
    // Construct packet exactly as EndpointV2 does
    const packet = {
      nonce: nonce + 1n,
      srcEid: Number(eid),
      sender: hre.ethers.zeroPadValue(baseOft.address, 32), // Packet uses bytes32 for sender
      dstEid: dstEid,
      receiver: hre.ethers.zeroPadValue(signer.address, 32),
      guid: hre.ethers.zeroHash, // Simplified
      message: "0x"
    };

    logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:105", "Before SendUln302.quote()", {
      packet
    });

    // But wait - SendUln302.quote() expects Packet calldata, and sender is bytes32 in Packet
    // But getUlnConfig() expects address. So there's a mismatch!
    // In _quoteDVNs(), it calls getUlnConfig(_sender, _dstEid) where _sender comes from _packet.sender
    // But _packet.sender is bytes32, not address!
    
    // Let me check the actual signature
    const sendUlnInterface = new hre.ethers.Interface([
      "function quote((uint64 nonce, uint32 srcEid, bytes32 sender, uint32 dstEid, bytes32 receiver, bytes32 guid, bytes message) calldata _packet, bytes calldata _options, bool _payInLzToken) external view returns ((uint256 nativeFee, uint256 lzTokenFee))"
    ]);
    
    const data = sendUlnInterface.encodeFunctionData("quote", [packet, "0x", false]);
    const result = await hre.ethers.provider.call({
      to: ownEndpoint.sendUln302,
      data: data
    });
    
    if (result === "0x") {
      console.log("   ❌ Call reverted");
    } else {
      const decoded = sendUlnInterface.decodeFunctionResult("quote", result);
      console.log("   ✅ SendUln302.quote() works!");
      console.log("   Native fee:", hre.ethers.formatEther(decoded[0].nativeFee), "ETH");
      logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:125", "SendUln302.quote() works", {
        nativeFee: decoded[0].nativeFee.toString()
      });
    }
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : (e.result && e.result.slice(0, 10)) || "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    if (e.result && e.result.length > 10) {
      console.log("   Error data:", e.result.slice(0, 100));
    }
    logDebug(runId, "HHH", "test-uln-config-in-quote-context.js:135", "SendUln302.quote() failed", {
      errorSig,
      error: e.message,
      result: e.result ? e.result.slice(0, 100) : null
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
