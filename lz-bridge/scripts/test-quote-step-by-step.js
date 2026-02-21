/**
 * Test quote() step by step to isolate where error 0x6592671c occurs
 * Test each component: DVNs, Executor, Treasury
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

  console.log("🔍 Testing quote() Step by Step\n");

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

  console.log("1. Testing getUlnConfig():");
  try {
    const ulnConfig = await sendUln.getAppUlnConfig(testSender, dstEid);
    console.log("   ✅ getUlnConfig() works");
    console.log("   Required DVN count:", ulnConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    logDebug(runId, "S", "test-quote-step-by-step.js:55", "getUlnConfig works", {
      requiredDVNCount: ulnConfig.requiredDVNCount.toString(),
      optionalDVNCount: ulnConfig.optionalDVNCount.toString()
    });
  } catch (e) {
    console.log("   ❌ getUlnConfig() fails:", e.message);
    logDebug(runId, "S", "test-quote-step-by-step.js:61", "getUlnConfig fails", {
      error: e.message
    });
  }

  console.log("\n2. Testing getExecutorConfig():");
  try {
    const executorConfig = await sendUln.executorConfigs(testSender, dstEid);
    console.log("   ✅ getExecutorConfig() works");
    console.log("   Executor:", executorConfig.executor);
    console.log("   Max message size:", executorConfig.maxMessageSize.toString());
    logDebug(runId, "S", "test-quote-step-by-step.js:71", "getExecutorConfig works", {
      executor: executorConfig.executor,
      maxMessageSize: executorConfig.maxMessageSize.toString()
    });
  } catch (e) {
    console.log("   ❌ getExecutorConfig() fails:", e.message);
    logDebug(runId, "S", "test-quote-step-by-step.js:77", "getExecutorConfig fails", {
      error: e.message
    });
  }

  console.log("\n3. Testing executor.getFee() directly:");
  try {
    const executorConfig = await sendUln.executorConfigs(testSender, dstEid);
    if (executorConfig.executor !== "0x0000000000000000000000000000000000000000") {
      const executor = await hre.ethers.getContractAt("ILayerZeroExecutor", executorConfig.executor);
      const fee = await executor.getFee(dstEid, testSender, 0, "0x");
      console.log("   ✅ executor.getFee() works");
      console.log("   Fee:", fee.toString());
      logDebug(runId, "S", "test-quote-step-by-step.js:90", "executor.getFee works", {
        fee: fee.toString()
      });
    } else {
      console.log("   ⚠️  Executor is zero");
    }
  } catch (e) {
    console.log("   ❌ executor.getFee() fails:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x6592671c") {
        console.log("   ⚠️  This is the same error!");
        logDebug(runId, "S", "test-quote-step-by-step.js:102", "executor.getFee has same error", {
          errorSig,
          confirmed: "Error originates from executor.getFee()"
        });
      }
    }
  }

  console.log("\n4. Testing SendUln302.quote() directly:");
  try {
    const fee = await sendUln.quote(packet, "0x", false);
    console.log("   ✅ SendUln302.quote() works");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "S", "test-quote-step-by-step.js:115", "SendUln302.quote works", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "S", "test-quote-step-by-step.js:122", "SendUln302.quote fails", {
      errorSig,
      error: e.message
    });
  }

  console.log("\n✅ Step-by-step test complete. Check logs for details.");
}

main().catch(console.error);
