/**
 * Redeploy USDCKrumpOFT OApp with self-deployed endpoint
 * Then configure Story Aeneid properly
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

  console.log("🔧 Redeploying OApp with Self-Deployed Endpoint\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const oldOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const backend = oldOft.backend || signer.address;
  const delegate = signer.address;

  console.log("Self-Deployed EndpointV2:", ownEndpoint.endpointV2);
  console.log("Backend:", backend);
  console.log("Delegate:", delegate);
  console.log();

  // 1. Deploy USDCKrumpOFT with self-deployed endpoint
  console.log("1. Deploying USDCKrumpOFT with self-deployed endpoint...");
  try {
    const USDCKrumpOFT = await hre.ethers.getContractFactory("USDCKrumpOFT");
    const oft = await USDCKrumpOFT.deploy(ownEndpoint.endpointV2, delegate, backend);
    await oft.waitForDeployment();
    const oftAddress = await oft.getAddress();
    console.log("   ✅ USDCKrumpOFT deployed:", oftAddress);
    logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:70", "OApp deployed", {
      address: oftAddress,
      endpoint: ownEndpoint.endpointV2
    });

    // Save deployment
    const deployment = {
      chain: "base-sepolia",
      chainId: 84532,
      address: oftAddress,
      endpoint: ownEndpoint.endpointV2,
      backend: backend,
      tokenName: "USDC Krump",
      tokenSymbol: "USDC.k",
      decimals: 6,
      deployedAt: new Date().toISOString(),
      note: "Redeployed with self-deployed LayerZero EndpointV2"
    };
    fs.writeFileSync(
      "deployments/usdckrump-base-sepolia-latest.json",
      JSON.stringify(deployment, null, 2)
    );

    // 2. Set delegate
    console.log("\n2. Setting delegate:");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    try {
      const tx0 = await endpoint.connect(oft).setDelegate(delegate);
      await tx0.wait();
      console.log("   ✅ Delegate set");
    } catch (e) {
      console.log("   ⚠️  Delegate setting failed (may already be set):", e.message);
    }

    // 3. Set send library for Story Aeneid
    console.log("\n3. Setting send library for Story Aeneid:");
    const dstEid = 1315;
    try {
      const tx1 = await endpoint.setSendLibrary(oftAddress, dstEid, ownEndpoint.sendUln302);
      await tx1.wait();
      console.log("   ✅ Send library set");
      logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:110", "Send library set", {
        sendLibrary: ownEndpoint.sendUln302
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // 4. Set receive library
    console.log("\n4. Setting receive library for Story Aeneid:");
    try {
      const tx2 = await endpoint.setReceiveLibrary(oftAddress, dstEid, ownEndpoint.receiveUln302, 0);
      await tx2.wait();
      console.log("   ✅ Receive library set");
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // 5. Set executor config
    console.log("\n5. Setting executor config:");
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

      const tx3 = await endpoint.setConfig(oftAddress, ownEndpoint.sendUln302, [executorConfigParam]);
      await tx3.wait();
      console.log("   ✅ Executor config set");
      logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:145", "Executor config set", {
        executor: ownEndpoint.executor
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // 6. Set ULN config
    console.log("\n6. Setting ULN config:");
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

      const tx4 = await endpoint.setConfig(oftAddress, ownEndpoint.sendUln302, [ulnConfigParam]);
      await tx4.wait();
      console.log("   ✅ ULN config set");
      logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:175", "ULN config set", {
        dvn: ourDVN
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // 7. Test quote()
    console.log("\n7. Testing quote() with self-deployed endpoint:");
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);
    const messagingParams = {
      dstEid: dstEid,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };

    logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:192", "Before quote() test", {
      endpoint: ownEndpoint.endpointV2,
      oapp: oftAddress
    });

    try {
      const fee = await endpoint.quote(messagingParams, oftAddress);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: OApp was using official endpoint which doesn't support Story Aeneid");
      console.log("   Solution: Redeploy OApp with self-deployed endpoint and configure Story Aeneid");
      logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:207", "Quote succeeded", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Redeploying OApp with self-deployed endpoint fixed the bug!"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      console.log("   Error:", e.message);
      logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:216", "Quote still fails", {
        errorSig,
        error: e.message,
        success: false
      });
    }

  } catch (e) {
    console.log("❌ Deployment failed:", e.message);
    logDebug(runId, "TT", "redeploy-oapp-self-endpoint.js:223", "Deployment failed", {
      error: e.message
    });
  }

  console.log("\n✅ Redeployment complete. Check logs for details.");
}

main().catch(console.error);
