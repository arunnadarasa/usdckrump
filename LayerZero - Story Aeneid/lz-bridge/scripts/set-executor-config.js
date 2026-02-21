/**
 * Set executor config for SendUln302
 * This might fix the error 0x6592671c
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

  console.log("🔧 Setting Executor Config\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const testSender = signer.address;
  const dstEid = 1315;

  // Check if Executor contract exists
  console.log("1. Checking for Executor contract:");
  let executorAddress = ownEndpoint.executor;
  
  if (!executorAddress || executorAddress === "0x0000000000000000000000000000000000000000") {
    console.log("   ⚠️  Executor not deployed, attempting to deploy...");
    try {
      const Executor = await hre.ethers.getContractFactory("Executor");
      const executor = await Executor.deploy(ownEndpoint.endpointV2);
      await executor.waitForDeployment();
      executorAddress = await executor.getAddress();
      console.log("   ✅ Executor deployed:", executorAddress);
      logDebug(runId, "Q", "set-executor-config.js:50", "Executor deployed", {
        executorAddress
      });
    } catch (e) {
      console.log("   ❌ Failed to deploy Executor:", e.message);
      console.log("   Need to deploy Executor contract first");
      logDebug(runId, "Q", "set-executor-config.js:56", "Executor deployment failed", {
        error: e.message
      });
      return;
    }
  } else {
    console.log("   ✅ Executor exists:", executorAddress);
  }

  // Set executor config on SendUln302
  console.log("\n2. Setting executor config on SendUln302:");
  try {
    const executorConfig = {
      maxMessageSize: 10000, // 10KB max message size
      executor: executorAddress
    };

    // Need to set via endpoint.setConfig()
    // configType 1 = Executor config
    const encodedConfig = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      [executorConfig]
    );

    const setConfigParam = {
      eid: dstEid,
      configType: 1, // Executor config
      config: encodedConfig
    };

    // Check if we're delegate
    const delegate = await endpoint.delegates(testSender);
    if (delegate === "0x0000000000000000000000000000000000000000") {
      console.log("   Setting delegate...");
      const txDelegate = await endpoint.setDelegate(signer.address);
      await txDelegate.wait();
      console.log("   ✅ Delegate set");
    }

    console.log("   Setting executor config...");
    const tx = await endpoint.setConfig(
      testSender,
      ownEndpoint.sendUln302,
      [setConfigParam]
    );
    await tx.wait();
    console.log("   ✅ Executor config set");
    logDebug(runId, "Q", "set-executor-config.js:95", "Executor config set", {
      executor: executorAddress,
      maxMessageSize: executorConfig.maxMessageSize,
      dstEid
    });

    // Verify
    const verifyConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
    const verifyConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      verifyConfigBytes
    )[0];
    console.log("   Verified executor:", verifyConfig.executor);
    console.log("   Verified max message size:", verifyConfig.maxMessageSize.toString());
  } catch (e) {
    console.log("   ❌ Failed to set executor config:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "Q", "set-executor-config.js:113", "Set config failed", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
    return;
  }

  // Test quote() after setting executor config
  console.log("\n3. Testing quote() after executor config fix:");
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
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   The issue was: Executor config was not set");
    logDebug(runId, "Q", "set-executor-config.js:135", "Quote succeeded after fix", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Setting executor config fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    logDebug(runId, "Q", "set-executor-config.js:143", "Quote still fails", {
      errorSig,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
