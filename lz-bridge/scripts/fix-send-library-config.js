/**
 * Fix send library configuration - it's returning zero address
 * Hypothesis CCC: sendLibrary mapping is not set for the OApp
 * Hypothesis DDD: Need to explicitly set send library for the OApp
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

  console.log("🔧 Fixing Send Library Configuration\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const dstEid = 1315;

  // Check current state
  console.log("1. Checking current send library configuration:");
  try {
    const [lib, isDefault] = await endpoint.getSendLibrary(baseOft.address, dstEid);
    console.log("   Library:", lib);
    console.log("   Is default:", isDefault);
    console.log("   Is zero?", lib === hre.ethers.ZeroAddress ? "✅ YES" : "❌ NO");
    logDebug(runId, "CCC", "fix-send-library-config.js:60", "Current send library", {
      library: lib,
      isDefault,
      isZero: lib === hre.ethers.ZeroAddress
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check default
  console.log("\n2. Checking default send library:");
  try {
    const defaultLib = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Default library:", defaultLib);
    logDebug(runId, "CCC", "fix-send-library-config.js:74", "Default send library", {
      defaultLibrary: defaultLib
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Hypothesis CCC: Set send library explicitly for the OApp
  console.log("\n3. Setting send library for OApp:");
  try {
    // Check if we're delegate
    const delegate = await endpoint.delegates(baseOft.address);
    console.log("   Delegate:", delegate);
    console.log("   Our address:", signer.address);
    const isDelegate = delegate.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we delegate?", isDelegate ? "✅ YES" : "❌ NO");
    
    if (!isDelegate) {
      console.log("   ⚠️  Not delegate - setting delegate first");
      // OApp needs to call setDelegate
      const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
      const owner = await oft.owner();
      if (owner.toLowerCase() === signer.address.toLowerCase()) {
        // We can call endpoint.setDelegate from the OApp
        const endpointInterface = new hre.ethers.Interface([
          "function setDelegate(address _delegate) external"
        ]);
        const data = endpointInterface.encodeFunctionData("setDelegate", [signer.address]);
        // Call via OApp owner
        const tx0 = await oft.connect(signer).endpoint.setDelegate(signer.address);
        await tx0.wait();
        console.log("   ✅ Delegate set");
      }
    }

    logDebug(runId, "DDD", "fix-send-library-config.js:100", "Before setSendLibrary", {
      oapp: baseOft.address,
      dstEid,
      sendLibrary: ownEndpoint.sendUln302
    });

    const tx = await endpoint.setSendLibrary(baseOft.address, dstEid, ownEndpoint.sendUln302);
    await tx.wait();
    console.log("   ✅ Send library set");
    logDebug(runId, "DDD", "fix-send-library-config.js:109", "Send library set", {
      sendLibrary: ownEndpoint.sendUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "DDD", "fix-send-library-config.js:118", "Error setting send library", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
  }

  // Verify it's set
  console.log("\n4. Verifying send library is set:");
  try {
    const [lib, isDefault] = await endpoint.getSendLibrary(baseOft.address, dstEid);
    console.log("   Library:", lib);
    console.log("   Is default:", isDefault);
    console.log("   Expected:", ownEndpoint.sendUln302);
    const isCorrect = lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase();
    console.log("   Is correct?", isCorrect ? "✅ YES" : "❌ NO");
    logDebug(runId, "DDD", "fix-send-library-config.js:133", "Send library verification", {
      library: lib,
      isDefault,
      expected: ownEndpoint.sendUln302,
      isCorrect
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote()
  console.log("\n5. Testing quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "DDD", "fix-send-library-config.js:152", "Before quote() test", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: sendLibrary mapping was not set for the OApp");
    console.log("   Solution: Set send library explicitly for the OApp");
    logDebug(runId, "DDD", "fix-send-library-config.js:165", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Setting send library for OApp fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "DDD", "fix-send-library-config.js:174", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
