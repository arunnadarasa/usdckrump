/**
 * Set default executor config on SendUln302 and test quote()
 * Hypothesis UU: Default executor config must be set using setDefaultExecutorConfigs
 * Hypothesis VV: ULN config must be set before executor config can work
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

  console.log("🔧 Setting Default Executor Config and Testing\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Executor:", ownEndpoint.executor);
  console.log("OApp:", baseOft.address);
  console.log();

  // Hypothesis UU: Set default executor config using setDefaultExecutorConfigs
  console.log("1. Setting default executor config:");
  try {
    const executorConfig = {
      maxMessageSize: 10000,
      executor: ownEndpoint.executor
    };

    const configParam = {
      eid: dstEid,
      config: executorConfig
    };

    logDebug(runId, "UU", "fix-executor-and-test.js:75", "Before setDefaultExecutorConfigs", {
      executor: ownEndpoint.executor,
      maxMessageSize: executorConfig.maxMessageSize
    });

    const tx = await sendUln.setDefaultExecutorConfigs([configParam]);
    await tx.wait();
    console.log("   ✅ Default executor config set");
    logDebug(runId, "UU", "fix-executor-and-test.js:85", "Default executor config set", {
      executor: ownEndpoint.executor
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "UU", "fix-executor-and-test.js:95", "Error setting executor config", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
  }

  // Check if executor config is set
  console.log("\n2. Verifying executor config:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const config = await sendUln.executorConfigs(DEFAULT_CONFIG, dstEid);
    console.log("   Executor:", config.executor);
    console.log("   Max message size:", config.maxMessageSize.toString());
    logDebug(runId, "UU", "fix-executor-and-test.js:110", "Executor config check", {
      executor: config.executor,
      maxMessageSize: config.maxMessageSize.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check if ULN config is set
  console.log("\n3. Verifying ULN config:");
  try {
    const DEFAULT_CONFIG = hre.ethers.ZeroAddress;
    const ulnConfig = await sendUln.getUlnConfig(DEFAULT_CONFIG, dstEid);
    console.log("   Confirmations:", ulnConfig.confirmations.toString());
    console.log("   Required DVN count:", ulnConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    logDebug(runId, "VV", "fix-executor-and-test.js:127", "ULN config check", {
      confirmations: ulnConfig.confirmations.toString(),
      requiredDVNCount: ulnConfig.requiredDVNCount.toString(),
      optionalDVNCount: ulnConfig.optionalDVNCount.toString()
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

  logDebug(runId, "UU", "fix-executor-and-test.js:148", "Before quote() test", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    logDebug(runId, "UU", "fix-executor-and-test.js:160", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Setting default executor config fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "UU", "fix-executor-and-test.js:169", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
