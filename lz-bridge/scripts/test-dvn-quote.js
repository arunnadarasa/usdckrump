/**
 * Test DVN quote() to see if error comes from DVN calls
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
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing DVN Quote\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;

  // Get ULN config
  console.log("1. Getting ULN config:");
  const ulnConfig = await sendUln.getAppUlnConfig(testSender, dstEid);
  console.log("   Required DVNs:", ulnConfig.requiredDVNs.length);
  console.log("   Optional DVNs:", ulnConfig.optionalDVNs.length);
  
  if (ulnConfig.optionalDVNs.length > 0) {
    console.log("   Optional DVN:", ulnConfig.optionalDVNs[0]);
    logDebug(runId, "T", "test-dvn-quote.js:50", "ULN config", {
      optionalDVN: ulnConfig.optionalDVNs[0],
      optionalDVNCount: ulnConfig.optionalDVNCount.toString()
    });
  }

  // Test calling DVN.getFee() directly
  console.log("\n2. Testing DVN.getFee() directly:");
  if (ulnConfig.optionalDVNs.length > 0) {
    const dvnAddress = ulnConfig.optionalDVNs[0];
    try {
      const dvn = await hre.ethers.getContractAt("ILayerZeroDVN", dvnAddress);
      const fee = await dvn.getFee(dstEid, ulnConfig.confirmations, testSender, "0x");
      console.log("   ✅ DVN.getFee() works");
      console.log("   Fee:", fee.toString());
      logDebug(runId, "T", "test-dvn-quote.js:66", "DVN.getFee works", {
        dvn: dvnAddress,
        fee: fee.toString()
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ DVN.getFee() fails:", errorSig);
      console.log("   Error:", e.message);
      if (errorSig === "0x6592671c") {
        console.log("   ⚠️  This is the same error!");
        logDebug(runId, "T", "test-dvn-quote.js:75", "DVN.getFee has same error", {
          errorSig,
          confirmed: "Error originates from DVN.getFee()"
        });
      } else {
        logDebug(runId, "T", "test-dvn-quote.js:80", "DVN.getFee different error", {
          errorSig,
          error: e.message
        });
      }
    }
  } else {
    console.log("   ⚠️  No DVNs configured");
  }

  // Test quote with empty options (should skip DVN calls if no options)
  console.log("\n3. Testing quote() with different message sizes:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
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

  try {
    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ quote() works!");
    logDebug(runId, "T", "test-dvn-quote.js:108", "Quote works", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() fails:", errorSig);
    logDebug(runId, "T", "test-dvn-quote.js:115", "Quote fails", {
      errorSig
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
