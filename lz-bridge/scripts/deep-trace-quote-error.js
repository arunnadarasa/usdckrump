/**
 * Deep trace of quote() error to identify the exact failure point
 * Hypothesis WW: Error might be from DVN.getFee() call
 * Hypothesis XX: Error might be from Executor.getFee() call
 * Hypothesis YY: Error might be from a validation check we haven't identified
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

  console.log("🔍 Deep Tracing quote() Error\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Check ULN config details
  console.log("1. Checking ULN config details:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const ulnConfig = await sendUln.getUlnConfig(DEFAULT_CONFIG, dstEid);
    console.log("   Confirmations:", ulnConfig.confirmations.toString());
    console.log("   Required DVNs:", ulnConfig.requiredDVNs.length);
    console.log("   Optional DVNs:", ulnConfig.optionalDVNs.length);
    if (ulnConfig.optionalDVNs.length > 0) {
      console.log("   Optional DVN[0]:", ulnConfig.optionalDVNs[0]);
    }
    logDebug(runId, "WW", "deep-trace-quote-error.js:60", "ULN config details", {
      confirmations: ulnConfig.confirmations.toString(),
      requiredDVNCount: ulnConfig.requiredDVNCount.toString(),
      optionalDVNCount: ulnConfig.optionalDVNCount.toString(),
      optionalDVNs: ulnConfig.optionalDVNs
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check executor config
  console.log("\n2. Checking executor config:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const executorConfig = await sendUln.executorConfigs(DEFAULT_CONFIG, dstEid);
    console.log("   Executor:", executorConfig.executor);
    console.log("   Max message size:", executorConfig.maxMessageSize.toString());
    logDebug(runId, "XX", "deep-trace-quote-error.js:78", "Executor config", {
      executor: executorConfig.executor,
      maxMessageSize: executorConfig.maxMessageSize.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test DVN.getFee() directly
  console.log("\n3. Testing DVN.getFee() directly:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const ulnConfig = await sendUln.getUlnConfig(DEFAULT_CONFIG, dstEid);
    if (ulnConfig.optionalDVNs.length > 0) {
      const dvnAddress = ulnConfig.optionalDVNs[0];
      const dvn = await hre.ethers.getContractAt("SimpleDVN", dvnAddress);
      const fee = await dvn.getFee(dstEid, 1, signer.address, "0x");
      console.log("   ✅ DVN.getFee() works:", fee.toString());
      logDebug(runId, "WW", "deep-trace-quote-error.js:97", "DVN.getFee() works", {
        dvn: dvnAddress,
        fee: fee.toString()
      });
    } else {
      console.log("   ⚠️  No DVNs configured");
    }
  } catch (e) {
    console.log("   ❌ DVN.getFee() failed:", e.message);
    logDebug(runId, "WW", "deep-trace-quote-error.js:105", "DVN.getFee() failed", {
      error: e.message
    });
  }

  // Test Executor.getFee() directly
  console.log("\n4. Testing Executor.getFee() directly:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const executorConfig = await sendUln.executorConfigs(DEFAULT_CONFIG, dstEid);
    if (executorConfig.executor !== hre.ethers.ZeroAddress) {
      const executor = await hre.ethers.getContractAt("SimpleExecutor", executorConfig.executor);
      const fee = await executor.getFee(dstEid, signer.address, 0, "0x");
      console.log("   ✅ Executor.getFee() works:", fee.toString());
      logDebug(runId, "XX", "deep-trace-quote-error.js:120", "Executor.getFee() works", {
        executor: executorConfig.executor,
        fee: fee.toString()
      });
    } else {
      console.log("   ⚠️  Executor is zero address");
    }
  } catch (e) {
    console.log("   ❌ Executor.getFee() failed:", e.message);
    logDebug(runId, "XX", "deep-trace-quote-error.js:129", "Executor.getFee() failed", {
      error: e.message
    });
  }

  // Try calling SendUln302.quote() directly
  console.log("\n5. Testing SendUln302.quote() directly:");
  try {
    const packet = {
      srcEid: 40245, // Base Sepolia EID
      sender: hre.ethers.zeroPadValue(baseOft.address, 32),
      receiver: hre.ethers.zeroPadValue(signer.address, 32),
      nonce: 0,
      message: "0x"
    };

    logDebug(runId, "YY", "deep-trace-quote-error.js:145", "Before SendUln302.quote()", {
      packet
    });

    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "YY", "deep-trace-quote-error.js:153", "SendUln302.quote() works", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "YY", "deep-trace-quote-error.js:160", "SendUln302.quote() failed", {
      errorSig,
      error: e.message
    });
  }

  // Test endpoint.quote()
  console.log("\n6. Testing endpoint.quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "YY", "deep-trace-quote-error.js:177", "Before endpoint.quote()", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ endpoint.quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "YY", "deep-trace-quote-error.js:186", "endpoint.quote() succeeded", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ endpoint.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "YY", "deep-trace-quote-error.js:193", "endpoint.quote() failed", {
      errorSig,
      error: e.message
    });
  }

  console.log("\n✅ Deep trace complete. Check logs for details.");
}

main().catch(console.error);
