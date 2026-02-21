/**
 * Test if setting executor config fixes the issue
 * The executor is currently zero, which might cause the error
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
  const [signer] = await hre.ethers.getSigners();
  const runId = `run_${Date.now()}`;

  console.log("🔧 Testing Executor Config Fix\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const testSender = signer.address;
  const dstEid = 1315;

  // Check current executor config
  console.log("1. Checking current executor config:");
  const configBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
  const config = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    configBytes
  )[0];
  
  console.log("   Executor:", config.executor);
  console.log("   Max message size:", config.maxMessageSize.toString());
  
  if (config.executor === "0x0000000000000000000000000000000000000000") {
    console.log("   ⚠️  Executor is zero - this might be the issue!");
    logDebug(runId, "P", "test-executor-config-fix.js:45", "Executor is zero", {
      executor: config.executor,
      hypothesis: "Zero executor causes error 0x6592671c"
    });
    
    // Check if we need to set executor config
    console.log("\n2. Need to set executor config:");
    console.log("   According to LayerZero docs, executor config must be set");
    console.log("   Let's check what executor address to use");
    
    // Try to find executor address from LayerZero deployments
    // For Base Sepolia, we might need to deploy or use a default executor
    console.log("   Need to configure executor using setConfig()");
    console.log("   This requires:");
    console.log("   1. Executor contract address");
    console.log("   2. Max message size");
    console.log("   3. Call endpoint.setConfig() with executor config");
    
    logDebug(runId, "P", "test-executor-config-fix.js:60", "Need executor config", {
      action: "Set executor config",
      required: ["executor address", "max message size"]
    });
  } else {
    console.log("   ✅ Executor is set");
  }

  // Test quote before fix
  console.log("\n3. Testing quote() before executor config fix:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    const fee = await endpoint.quote(messagingParams, testSender);
    console.log("   ✅ quote() works!");
    logDebug(runId, "P", "test-executor-config-fix.js:80", "Quote works", {
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() fails with:", errorSig);
    logDebug(runId, "P", "test-executor-config-fix.js:86", "Quote fails", {
      errorSig,
      hypothesis: "Zero executor causes this error"
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
  console.log("\n💡 Next step: Set executor config using setConfig()");
  console.log("   This might fix the error 0x6592671c");
}

main().catch(console.error);
