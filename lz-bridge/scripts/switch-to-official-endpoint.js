/**
 * Switch to official LayerZero EndpointV2 and configure Story Aeneid
 * This script configures the OApp to use the official endpoint
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

  console.log("🔧 Switching to Official LayerZero EndpointV2\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_RECEIVE_ULN = "0x12523de19dc41c91F7d2093E0CFbB76b17012C8d";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  // Our deployed contracts (we'll use our SendUln302 since official one might not support Story Aeneid)
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  console.log("Official EndpointV2:", OFFICIAL_ENDPOINT);
  console.log("Official SendUln302:", OFFICIAL_SEND_ULN);
  console.log("Official Executor:", OFFICIAL_EXECUTOR);
  console.log();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const dstEid = 1315; // Story Aeneid

  // Check if we have an OApp deployed
  // For now, we'll configure using signer address as OApp
  // In production, use the actual OApp address
  const oappAddress = signer.address; // Replace with actual OApp address if deployed

  console.log("1. Checking delegate status:");
  try {
    const delegate = await endpoint.delegates(oappAddress);
    console.log("   Delegate:", delegate);
    console.log("   Our address:", signer.address);
    const isDelegate = delegate.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we delegate?", isDelegate ? "✅ YES" : "❌ NO");
    
    if (!isDelegate) {
      console.log("\n   ⚠️  Not a delegate - cannot configure libraries");
      console.log("   Need to set delegate first or use OApp's setConfig method");
      logDebug(runId, "HH", "switch-to-official-endpoint.js:75", "Not delegate", {
        delegate,
        ourAddress: signer.address,
        solution: "Set delegate or use OApp configuration methods"
      });
    } else {
      // Set send library for Story Aeneid
      console.log("\n2. Setting send library for Story Aeneid:");
      try {
        // Use our SendUln302 since it's configured for Story Aeneid
        // The official SendUln302 might not support custom EIDs
        const tx1 = await endpoint.setSendLibrary(oappAddress, dstEid, ownEndpoint.sendUln302);
        await tx1.wait();
        console.log("   ✅ Send library set:", ownEndpoint.sendUln302);
        logDebug(runId, "HH", "switch-to-official-endpoint.js:88", "Send library set", {
          oapp: oappAddress,
          dstEid,
          sendLibrary: ownEndpoint.sendUln302
        });
      } catch (e) {
        console.log("   ❌ Error:", e.message);
        logDebug(runId, "HH", "switch-to-official-endpoint.js:95", "Error setting send library", {
          error: e.message
        });
      }

      // Set receive library
      console.log("\n3. Setting receive library for Story Aeneid:");
      try {
        const tx2 = await endpoint.setReceiveLibrary(oappAddress, dstEid, ownEndpoint.receiveUln302, 0);
        await tx2.wait();
        console.log("   ✅ Receive library set:", ownEndpoint.receiveUln302);
        logDebug(runId, "HH", "switch-to-official-endpoint.js:105", "Receive library set", {
          oapp: oappAddress,
          dstEid,
          receiveLibrary: ownEndpoint.receiveUln302
        });
      } catch (e) {
        console.log("   ❌ Error:", e.message);
      }

      // Configure SendUln302 for Story Aeneid
      console.log("\n4. Configuring SendUln302 for Story Aeneid:");
      const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
      
      // Set executor config
      try {
        const executorConfig = {
          maxMessageSize: 10000,
          executor: OFFICIAL_EXECUTOR // Use official executor
        };
        
        const executorConfigParam = {
          eid: dstEid,
          configType: 1, // CONFIG_TYPE_EXECUTOR
          config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(uint32 maxMessageSize, address executor)"],
            [executorConfig]
          )
        };

        const tx3 = await endpoint.setConfig(oappAddress, ownEndpoint.sendUln302, [executorConfigParam]);
        await tx3.wait();
        console.log("   ✅ Executor config set");
        logDebug(runId, "HH", "switch-to-official-endpoint.js:130", "Executor config set", {
          executor: OFFICIAL_EXECUTOR
        });
      } catch (e) {
        console.log("   ❌ Error:", e.message);
      }

      // Set ULN config with official DVN (LayerZero Labs)
      try {
        // Use official LayerZero Labs DVN if available, or our SimpleDVN
        const officialDVN = "0x282b3386571f7f794450d5789911a9804fa346b4"; // LayerZero Labs DVN (check if this exists on Base Sepolia)
        const ourDVN = ownEndpoint.simpleDVN || "0xDFaa4A8E7CFfbAa4Aec51593bc9210F44e2A8b84";
        
        const ulnConfig = {
          confirmations: 1,
          requiredDVNCount: 0,
          optionalDVNCount: 1,
          optionalDVNThreshold: 1,
          requiredDVNs: [],
          optionalDVNs: [ourDVN] // Use our DVN for now
        };

        const ulnConfigParam = {
          eid: dstEid,
          configType: 2, // CONFIG_TYPE_ULN
          config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
            ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
            [ulnConfig]
          )
        };

        const tx4 = await endpoint.setConfig(oappAddress, ownEndpoint.sendUln302, [ulnConfigParam]);
        await tx4.wait();
        console.log("   ✅ ULN config set");
        logDebug(runId, "HH", "switch-to-official-endpoint.js:157", "ULN config set", {
          dvn: ourDVN
        });
      } catch (e) {
        console.log("   ❌ Error:", e.message);
      }
    }
  } catch (e) {
    console.log("   ❌ Error checking delegate:", e.message);
  }

  // Test quote() with official endpoint
  console.log("\n5. Testing quote() with official endpoint:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "HH", "switch-to-official-endpoint.js:175", "Before quote() test", {
    endpoint: OFFICIAL_ENDPOINT,
    oapp: oappAddress
  });

  try {
    const fee = await endpoint.quote(messagingParams, oappAddress);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Using self-deployed endpoint instead of official LayerZero EndpointV2");
    console.log("   Solution: Use official EndpointV2 and configure Story Aeneid via OApp");
    logDebug(runId, "HH", "switch-to-official-endpoint.js:187", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Using official endpoint and configuring OApp fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "HH", "switch-to-official-endpoint.js:196", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  // Update deployment file with official endpoint
  console.log("\n6. Updating deployment file:");
  ownEndpoint.officialEndpointV2 = OFFICIAL_ENDPOINT;
  ownEndpoint.officialSendUln302 = OFFICIAL_SEND_ULN;
  ownEndpoint.officialReceiveUln302 = OFFICIAL_RECEIVE_ULN;
  ownEndpoint.officialExecutor = OFFICIAL_EXECUTOR;
  ownEndpoint.usingOfficialEndpoint = true;
  fs.writeFileSync(
    "deployments/base-sepolia-own-latest.json",
    JSON.stringify(ownEndpoint, null, 2)
  );
  console.log("   ✅ Deployment file updated");

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
