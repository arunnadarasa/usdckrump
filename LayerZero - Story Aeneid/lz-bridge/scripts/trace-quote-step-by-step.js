/**
 * Trace quote() step by step to find exact failure point
 * Hypothesis JJJ: Error occurs in a specific step of _quote() flow
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

  console.log("🔍 Tracing quote() Step by Step\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;
  const sender = baseOft.address;
  const msgSize = 0; // Empty message
  const payInLzToken = false;
  const options = "0x";

  // Step 1: Test _splitOptions (if accessible)
  console.log("Step 1: Testing options splitting...");
  logDebug(runId, "JJJ", "trace-quote-step-by-step.js:60", "Step 1: splitOptions", {
    options
  });

  // Step 2: Test _quoteVerifier (which calls _quoteDVNs)
  console.log("\nStep 2: Testing _quoteVerifier (DVNs)...");
  try {
    // We can't call _quoteVerifier directly, but we can test getUlnConfig
    const ulnConfig = await sendUln.getUlnConfig(sender, dstEid);
    console.log("   ✅ ULN config retrieved");
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    
    // Test DVN.getFee() directly
    if (ulnConfig.optionalDVNs.length > 0) {
      const dvn = ulnConfig.optionalDVNs[0];
      const dvnInterface = new hre.ethers.Interface([
        "function getFee(uint32 _dstEid, uint64 _confirmations, address _sender, bytes calldata _options) external view returns (uint256)"
      ]);
      const dvnFeeData = dvnInterface.encodeFunctionData("getFee", [dstEid, ulnConfig.confirmations, sender, "0x"]);
      const dvnResult = await hre.ethers.provider.call({ to: dvn, data: dvnFeeData });
      const dvnFee = dvnInterface.decodeFunctionResult("getFee", dvnResult)[0];
      console.log("   ✅ DVN.getFee() works:", hre.ethers.formatEther(dvnFee), "ETH");
      logDebug(runId, "JJJ", "trace-quote-step-by-step.js:78", "Step 2: DVN.getFee()", {
        dvnFee: dvnFee.toString()
      });
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:85", "Step 2: Error", {
      error: e.message
    });
  }

  // Step 3: Test getExecutorConfig
  console.log("\nStep 3: Testing getExecutorConfig...");
  try {
    const executorConfig = await sendUln.getExecutorConfig(sender, dstEid);
    console.log("   ✅ Executor config retrieved");
    console.log("   Executor:", executorConfig.executor);
    console.log("   Max message size:", executorConfig.maxMessageSize.toString());
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:97", "Step 3: Executor config", {
      executor: executorConfig.executor,
      maxMessageSize: executorConfig.maxMessageSize.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:104", "Step 3: Error", {
      error: e.message
    });
  }

  // Step 4: Test Executor.getFee()
  console.log("\nStep 4: Testing Executor.getFee()...");
  try {
    const executorConfig = await sendUln.getExecutorConfig(sender, dstEid);
    const executorInterface = new hre.ethers.Interface([
      "function getFee(uint32 _dstEid, address _sender, uint256 _calldataSize, bytes calldata _options) external view returns (uint256)"
    ]);
    const executorFeeData = executorInterface.encodeFunctionData("getFee", [dstEid, sender, msgSize, "0x"]);
    const executorResult = await hre.ethers.provider.call({ to: executorConfig.executor, data: executorFeeData });
    const executorFee = executorInterface.decodeFunctionResult("getFee", executorResult)[0];
    console.log("   ✅ Executor.getFee() works:", hre.ethers.formatEther(executorFee), "ETH");
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:118", "Step 4: Executor.getFee()", {
      executorFee: executorFee.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:124", "Step 4: Error", {
      error: e.message
    });
  }

  // Step 5: Test _quoteTreasury (treasury is zero, should return 0,0)
  console.log("\nStep 5: Testing treasury...");
  try {
    const treasury = await sendUln.treasury();
    console.log("   Treasury:", treasury);
    console.log("   Is zero?", treasury === hre.ethers.ZeroAddress ? "✅ YES" : "❌ NO");
    if (treasury === hre.ethers.ZeroAddress) {
      console.log("   ✅ Treasury is zero, _quoteTreasury should return (0, 0)");
    }
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:137", "Step 5: Treasury", {
      treasury,
      isZero: treasury === hre.ethers.ZeroAddress
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:143", "Step 5: Error", {
      error: e.message
    });
  }

  // Step 6: Try calling SendUln302.quote() directly with proper packet structure
  console.log("\nStep 6: Testing SendUln302.quote() directly...");
  try {
    const eid = await endpoint.eid();
    const nonce = await endpoint.outboundNonce(sender, dstEid, hre.ethers.zeroPadValue(signer.address, 32));
    
    // Construct packet exactly as EndpointV2 does
    const packet = {
      nonce: nonce + 1n,
      srcEid: Number(eid),
      sender: sender, // address, not bytes32
      dstEid: dstEid,
      receiver: hre.ethers.zeroPadValue(signer.address, 32),
      guid: hre.ethers.zeroHash, // Simplified - should use GUID.generate
      message: "0x"
    };

    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:163", "Step 6: Before SendUln302.quote()", {
      packet
    });

    // Call quote() directly
    const fee = await sendUln.quote(packet, options, payInLzToken);
    console.log("   ✅ SendUln302.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:172", "Step 6: SendUln302.quote() success", {
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : (e.result && e.result.slice(0, 10)) || "unknown";
    console.log("   ❌ SendUln302.quote() failed:", errorSig);
    console.log("   Error:", e.message);
    if (e.data && e.data.length > 10) {
      console.log("   Error data:", e.data);
    }
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:182", "Step 6: SendUln302.quote() failed", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 100) : null
    });
  }

  // Step 7: Try EndpointV2.quote()
  console.log("\nStep 7: Testing EndpointV2.quote()...");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "JJJ", "trace-quote-step-by-step.js:198", "Step 7: Before EndpointV2.quote()", {
    endpoint: ownEndpoint.endpointV2,
    oapp: sender
  });

  try {
    const fee = await endpoint.quote(messagingParams, sender);
    console.log("   ✅ EndpointV2.quote() works!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("\n   🎉 BUG FIXED!");
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:210", "Step 7: EndpointV2.quote() success", {
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
    logDebug(runId, "JJJ", "trace-quote-step-by-step.js:221", "Step 7: EndpointV2.quote() failed", {
      errorSig,
      error: e.message,
      errorData: e.data ? e.data.slice(0, 100) : null,
      success: false
    });
  }

  console.log("\n✅ Step-by-step trace complete. Check logs for details.");
}

main().catch(console.error);
