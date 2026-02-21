/**
 * Fix self-deployed endpoint configuration for Story Aeneid
 * Hypothesis QQ: Self-deployed endpoint needs proper default configurations
 * Hypothesis RR: Default send library must be set for EID 1315
 * Hypothesis SS: ULN and Executor configs must be set as defaults
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

  console.log("🔧 Fixing Self-Deployed Endpoint Configuration\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const dstEid = 1315; // Story Aeneid

  console.log("EndpointV2:", ownEndpoint.endpointV2);
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("ReceiveUln302:", ownEndpoint.receiveUln302);
  console.log("Executor:", ownEndpoint.executor);
  console.log("SimpleDVN:", ownEndpoint.simpleDVN);
  console.log();

  // Check if we're the owner
  console.log("1. Checking ownership:");
  try {
    const endpointOwner = await endpoint.owner();
    const sendUlnOwner = await sendUln.owner();
    console.log("   EndpointV2 owner:", endpointOwner);
    console.log("   SendUln302 owner:", sendUlnOwner);
    console.log("   Our address:", signer.address);
    const isEndpointOwner = endpointOwner.toLowerCase() === signer.address.toLowerCase();
    const isSendUlnOwner = sendUlnOwner.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we endpoint owner?", isEndpointOwner ? "✅ YES" : "❌ NO");
    console.log("   Are we SendUln302 owner?", isSendUlnOwner ? "✅ YES" : "❌ NO");
    
    if (!isEndpointOwner || !isSendUlnOwner) {
      console.log("\n   ⚠️  Cannot configure - not owner");
      logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:70", "Not owner", {
        endpointOwner,
        sendUlnOwner,
        ourAddress: signer.address
      });
      return;
    }
    logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:75", "Ownership confirmed", {
      isEndpointOwner,
      isSendUlnOwner
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    return;
  }

  // Hypothesis RR: Set default send library for EID 1315
  console.log("\n2. Setting default send library for Story Aeneid:");
  try {
    const currentDefault = await endpoint.defaultSendLibrary(dstEid);
    console.log("   Current default:", currentDefault);
    
    if (currentDefault.toLowerCase() !== ownEndpoint.sendUln302.toLowerCase()) {
      const tx1 = await endpoint.setDefaultSendLibrary(dstEid, ownEndpoint.sendUln302);
      await tx1.wait();
      console.log("   ✅ Default send library set");
      logDebug(runId, "RR", "fix-self-deployed-endpoint.js:95", "Default send library set", {
        dstEid,
        sendLibrary: ownEndpoint.sendUln302
      });
    } else {
      console.log("   ✅ Default send library already set");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "RR", "fix-self-deployed-endpoint.js:104", "Error setting default send library", {
      error: e.message
    });
  }

  // Set default receive library
  console.log("\n3. Setting default receive library for Story Aeneid:");
  try {
    const tx2 = await endpoint.setDefaultReceiveLibrary(dstEid, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Default receive library set");
    logDebug(runId, "RR", "fix-self-deployed-endpoint.js:115", "Default receive library set", {
      dstEid,
      receiveLibrary: ownEndpoint.receiveUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Hypothesis SS: Set default ULN config on SendUln302
  console.log("\n4. Setting default ULN config on SendUln302:");
  try {
    const ourDVN = ownEndpoint.simpleDVN || "0xDFaa4A8E7CFfbAa4Aec51593bc9210F44e2A8b84";
    
    // Check if default config already exists
    const defaultConfig = await sendUln.getUlnConfig(hre.ethers.ZeroAddress, dstEid);
    console.log("   Current default config confirmations:", defaultConfig.confirmations.toString());
    
    if (defaultConfig.confirmations === 0n) {
      // Set default ULN config
      const ulnConfig = {
        eid: dstEid,
        config: {
          confirmations: 1,
          requiredDVNCount: 0,
          optionalDVNCount: 1,
          optionalDVNThreshold: 1,
          requiredDVNs: [],
          optionalDVNs: [ourDVN]
        }
      };

      const tx3 = await sendUln.setDefaultUlnConfigs([ulnConfig]);
      await tx3.wait();
      console.log("   ✅ Default ULN config set");
      logDebug(runId, "SS", "fix-self-deployed-endpoint.js:142", "Default ULN config set", {
        dstEid,
        dvn: ourDVN
      });
    } else {
      console.log("   ✅ Default ULN config already set");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "SS", "fix-self-deployed-endpoint.js:154", "Error setting default ULN config", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
  }

  // Set default executor config
  console.log("\n5. Setting default executor config:");
  try {
    const executorConfig = {
      maxMessageSize: 10000,
      executor: ownEndpoint.executor
    };

    const executorConfigParam = {
      eid: dstEid,
      configType: 1,
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint32 maxMessageSize, address executor)"],
        [executorConfig]
      )
    };

    // Set as default (use zero address as OApp)
    const tx4 = await endpoint.setConfig(hre.ethers.ZeroAddress, ownEndpoint.sendUln302, [executorConfigParam]);
    await tx4.wait();
    console.log("   ✅ Default executor config set");
    logDebug(runId, "SS", "fix-self-deployed-endpoint.js:180", "Default executor config set", {
      executor: ownEndpoint.executor
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Verify SendUln302 supports EID 1315
  console.log("\n6. Verifying SendUln302 supports EID 1315:");
  try {
    const supports = await sendUln.isSupportedEid(dstEid);
    console.log("   Supports EID 1315?", supports ? "✅ YES" : "❌ NO");
    logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:193", "EID support check", {
      supports
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote() with self-deployed endpoint
  console.log("\n7. Testing quote() with self-deployed endpoint:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:210", "Before quote() test", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Self-deployed endpoint lacked default configurations");
    console.log("   Solution: Set default send library, ULN config, and executor config");
    logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:223", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Setting default configurations fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "QQ", "fix-self-deployed-endpoint.js:232", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
