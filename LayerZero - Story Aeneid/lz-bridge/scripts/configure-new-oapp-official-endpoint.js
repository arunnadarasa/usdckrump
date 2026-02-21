/**
 * Configure newly deployed USDCKrumpOFT OApp with official LayerZero EndpointV2
 * Set delegate first, then configure Story Aeneid
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

  console.log("🔧 Configuring New USDCKrumpOFT OApp with Official EndpointV2\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  // Our deployed contracts
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const oappAddress = baseOft.address;
  const dstEid = 1315; // Story Aeneid

  console.log("OApp (USDCKrumpOFT):", oappAddress);
  console.log("Official EndpointV2:", OFFICIAL_ENDPOINT);
  console.log("Destination EID:", dstEid);
  console.log();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", oappAddress);

  // Verify OApp is using official endpoint
  const oappEndpoint = await oft.endpoint();
  if (oappEndpoint.toLowerCase() !== OFFICIAL_ENDPOINT.toLowerCase()) {
    console.log("❌ OApp is not using official endpoint!");
    console.log("   OApp endpoint:", oappEndpoint);
    console.log("   Official endpoint:", OFFICIAL_ENDPOINT);
    return;
  }
  console.log("✅ OApp is using official endpoint\n");

  // Step 1: Set delegate (OApp calls endpoint.setDelegate)
  console.log("1. Setting delegate:");
  try {
    // OApp calls setDelegate to authorize signer
    const tx0 = await oft.connect(signer).endpoint.setDelegate(signer.address);
    await tx0.wait();
    console.log("   ✅ Delegate set:", signer.address);
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:85", "Delegate set", {
      delegate: signer.address
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    // Try calling directly from OApp
    try {
      const endpointInterface = new hre.ethers.Interface([
        "function setDelegate(address _delegate) external"
      ]);
      const data = endpointInterface.encodeFunctionData("setDelegate", [signer.address]);
      const tx0b = await signer.sendTransaction({
        to: oappAddress,
        data: hre.ethers.solidityPacked(
          ["bytes4", "bytes"],
          [hre.ethers.id("endpoint.setDelegate(address)").slice(0, 10), data]
        )
      });
      await tx0b.wait();
      console.log("   ✅ Delegate set (alternative method)");
    } catch (e2) {
      console.log("   ❌ Alternative method also failed:", e2.message);
      logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:102", "Delegate set failed", {
        error: e.message,
        error2: e2.message
      });
    }
  }

  // Verify delegate
  const delegate = await endpoint.delegates(oappAddress);
  console.log("   Current delegate:", delegate);
  const isDelegate = delegate.toLowerCase() === signer.address.toLowerCase();
  console.log("   Are we delegate?", isDelegate ? "✅ YES" : "❌ NO");
  
  if (!isDelegate) {
    console.log("\n   ⚠️  Cannot proceed - delegate not set");
    return;
  }

  // Step 2: Set send library
  console.log("\n2. Setting send library for Story Aeneid:");
  try {
    const tx1 = await endpoint.setSendLibrary(oappAddress, dstEid, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Send library set:", ownEndpoint.sendUln302);
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:125", "Send library set", {
      sendLibrary: ownEndpoint.sendUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:134", "Error setting send library", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
  }

  // Step 3: Set receive library
  console.log("\n3. Setting receive library for Story Aeneid:");
  try {
    const tx2 = await endpoint.setReceiveLibrary(oappAddress, dstEid, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Receive library set:", ownEndpoint.receiveUln302);
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:147", "Receive library set", {
      receiveLibrary: ownEndpoint.receiveUln302
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Step 4: Configure executor
  console.log("\n4. Configuring executor:");
  try {
    const executorConfig = {
      maxMessageSize: 10000,
      executor: OFFICIAL_EXECUTOR
    };
    
    const executorConfigParam = {
      eid: dstEid,
      configType: 1,
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint32 maxMessageSize, address executor)"],
        [executorConfig]
      )
    };

    const tx3 = await endpoint.setConfig(oappAddress, ownEndpoint.sendUln302, [executorConfigParam]);
    await tx3.wait();
    console.log("   ✅ Executor config set");
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:172", "Executor config set", {
      executor: OFFICIAL_EXECUTOR
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Step 5: Configure ULN
  console.log("\n5. Configuring ULN:");
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
      configType: 2,
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
        [ulnConfig]
      )
    };

    const tx4 = await endpoint.setConfig(oappAddress, ownEndpoint.sendUln302, [ulnConfigParam]);
    await tx4.wait();
    console.log("   ✅ ULN config set");
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:200", "ULN config set", {
      dvn: ourDVN
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Step 6: Test quote()
  console.log("\n6. Testing quote() with official endpoint:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:220", "Before quote() test", {
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
    console.log("   Solution: Redeploy OApp with official EndpointV2 and configure Story Aeneid");
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:234", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString(),
      fixConfirmed: "Using official endpoint and configuring OApp fixed the bug!"
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "KK", "configure-new-oapp-official-endpoint.js:243", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Configuration complete. Check logs for details.");
}

main().catch(console.error);
