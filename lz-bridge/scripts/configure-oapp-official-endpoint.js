/**
 * Configure USDCKrumpOFT OApp to use official LayerZero EndpointV2
 * Set send library, receive library, and ULN/Executor configs for Story Aeneid
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

  console.log("🔧 Configuring USDCKrumpOFT OApp with Official EndpointV2\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  // Our deployed contracts
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const oappAddress = baseOft.address;
  const dstEid = 1315; // Story Aeneid

  console.log("OApp (USDCKrumpOFT):", oappAddress);
  console.log("Official EndpointV2:", OFFICIAL_ENDPOINT);
  console.log("Destination EID:", dstEid);
  console.log();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", oappAddress);

  // Check if OApp is using official endpoint
  console.log("1. Checking OApp endpoint:");
  try {
    const oappEndpoint = await oft.endpoint();
    console.log("   OApp endpoint:", oappEndpoint);
    console.log("   Official endpoint:", OFFICIAL_ENDPOINT);
    const isOfficial = oappEndpoint.toLowerCase() === OFFICIAL_ENDPOINT.toLowerCase();
    console.log("   Using official?", isOfficial ? "✅ YES" : "❌ NO");
    
    if (!isOfficial) {
      console.log("\n   ⚠️  OApp is using different endpoint!");
      console.log("   OApp was deployed with:", oappEndpoint);
      console.log("   Cannot change endpoint after deployment.");
      console.log("   Need to redeploy OApp with official endpoint.");
      logDebug(runId, "II", "configure-oapp-official-endpoint.js:75", "OApp using different endpoint", {
        oappEndpoint,
        officialEndpoint: OFFICIAL_ENDPOINT,
        solution: "Redeploy OApp with official endpoint"
      });
      return;
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    return;
  }

  // Check delegate
  console.log("\n2. Checking delegate:");
  try {
    const delegate = await endpoint.delegates(oappAddress);
    console.log("   Delegate:", delegate);
    console.log("   Our address:", signer.address);
    const isDelegate = delegate.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we delegate?", isDelegate ? "✅ YES" : "❌ NO");
    
    if (!isDelegate) {
      console.log("\n   ⚠️  Not a delegate - checking OApp owner:");
      const owner = await oft.owner();
      console.log("   OApp owner:", owner);
      const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
      console.log("   Are we owner?", isOwner ? "✅ YES" : "❌ NO");
      
      if (!isOwner) {
        console.log("\n   ❌ Cannot configure - not delegate or owner");
        logDebug(runId, "II", "configure-oapp-official-endpoint.js:100", "Not delegate or owner", {
          delegate,
          owner,
          ourAddress: signer.address
        });
        return;
      }
    }
    
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:107", "Delegate check", {
      delegate,
      isDelegate,
      canConfigure: isDelegate || (await oft.owner()).toLowerCase() === signer.address.toLowerCase()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    return;
  }

  // Set send library
  console.log("\n3. Setting send library for Story Aeneid:");
  try {
    // Use our SendUln302 since it's configured for Story Aeneid
    // The official SendUln302 might not support custom EIDs like 1315
    const tx1 = await endpoint.setSendLibrary(oappAddress, dstEid, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Send library set:", ownEndpoint.sendUln302);
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:125", "Send library set", {
      oapp: oappAddress,
      dstEid,
      sendLibrary: ownEndpoint.sendUln302
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Error:", e.message);
    console.log("   Error signature:", errorSig);
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:134", "Error setting send library", {
      error: e.message,
      errorSig
    });
  }

  // Set receive library
  console.log("\n4. Setting receive library for Story Aeneid:");
  try {
    const tx2 = await endpoint.setReceiveLibrary(oappAddress, dstEid, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Receive library set:", ownEndpoint.receiveUln302);
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:145", "Receive library set", {
      oapp: oappAddress,
      dstEid,
      receiveLibrary: ownEndpoint.receiveUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Configure SendUln302 for Story Aeneid
  console.log("\n5. Configuring SendUln302 for Story Aeneid:");
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  
  // Set executor config
  try {
    const executorConfig = {
      maxMessageSize: 10000,
      executor: OFFICIAL_EXECUTOR
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
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:172", "Executor config set", {
      executor: OFFICIAL_EXECUTOR
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Set ULN config
  try {
    const ourDVN = ownEndpoint.simpleDVN || "0xDFaa4A8E7CFfbAa4Aec51593bc9210F44e2A8b84";
    
    const ulnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [ourDVN]
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
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:198", "ULN config set", {
      dvn: ourDVN
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote() with official endpoint
  console.log("\n6. Testing quote() with official endpoint:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "II", "configure-oapp-official-endpoint.js:215", "Before quote() test", {
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
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:229", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Using official endpoint and configuring OApp fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "II", "configure-oapp-official-endpoint.js:238", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
