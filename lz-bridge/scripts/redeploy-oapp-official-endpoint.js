/**
 * Redeploy USDCKrumpOFT OApp with official LayerZero EndpointV2
 * Then configure Story Aeneid
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

  console.log("🔧 Redeploying USDCKrumpOFT OApp with Official EndpointV2\n");

  // Official LayerZero contracts for Base Sepolia
  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";

  // Our deployed contracts (for SendUln302/ReceiveUln302 that support Story Aeneid)
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const oldOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const backend = oldOft.backend || signer.address;
  const delegate = signer.address; // OApp owner/delegate

  console.log("Official EndpointV2:", OFFICIAL_ENDPOINT);
  console.log("Backend:", backend);
  console.log("Delegate:", delegate);
  console.log();

  // 1. Deploy USDCKrumpOFT with official endpoint
  console.log("1. Deploying USDCKrumpOFT with official endpoint...");
  try {
    const USDCKrumpOFT = await hre.ethers.getContractFactory("USDCKrumpOFT");
    const oft = await USDCKrumpOFT.deploy(OFFICIAL_ENDPOINT, delegate, backend);
    await oft.waitForDeployment();
    const oftAddress = await oft.getAddress();
    console.log("   ✅ USDCKrumpOFT deployed:", oftAddress);
    logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:70", "OApp deployed", {
      address: oftAddress,
      endpoint: OFFICIAL_ENDPOINT
    });

    // Save deployment
    const deployment = {
      chain: "base-sepolia",
      chainId: 84532,
      address: oftAddress,
      endpoint: OFFICIAL_ENDPOINT,
      backend: backend,
      tokenName: "USDC Krump",
      tokenSymbol: "USDC.k",
      decimals: 6,
      deployedAt: new Date().toISOString(),
      note: "Redeployed with official LayerZero EndpointV2"
    };
    fs.writeFileSync(
      "deployments/usdckrump-base-sepolia-latest.json",
      JSON.stringify(deployment, null, 2)
    );

    // 2. Configure Story Aeneid
    console.log("\n2. Configuring Story Aeneid (EID 1315)...");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
    const dstEid = 1315;

    // Set send library (use our SendUln302 since it supports Story Aeneid)
    console.log("   Setting send library...");
    try {
      const tx1 = await endpoint.setSendLibrary(oftAddress, dstEid, ownEndpoint.sendUln302);
      await tx1.wait();
      console.log("   ✅ Send library set");
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:100", "Send library set", {
        sendLibrary: ownEndpoint.sendUln302
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // Set receive library
    console.log("   Setting receive library...");
    try {
      const tx2 = await endpoint.setReceiveLibrary(oftAddress, dstEid, ownEndpoint.receiveUln302, 0);
      await tx2.wait();
      console.log("   ✅ Receive library set");
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:112", "Receive library set", {
        receiveLibrary: ownEndpoint.receiveUln302
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // Configure executor
    console.log("   Configuring executor...");
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

      const tx3 = await endpoint.setConfig(oftAddress, ownEndpoint.sendUln302, [executorConfigParam]);
      await tx3.wait();
      console.log("   ✅ Executor config set");
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:135", "Executor config set", {
        executor: OFFICIAL_EXECUTOR
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // Configure ULN
    console.log("   Configuring ULN...");
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
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:162", "ULN config set", {
        dvn: ourDVN
      });
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }

    // 3. Test quote()
    console.log("\n3. Testing quote() with official endpoint:");
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);
    const messagingParams = {
      dstEid: dstEid,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };

    logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:178", "Before quote() test", {
      endpoint: OFFICIAL_ENDPOINT,
      oapp: oftAddress
    });

    try {
      const fee = await endpoint.quote(messagingParams, oftAddress);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: OApp was deployed with wrong endpoint");
      console.log("   Solution: Redeploy OApp with official LayerZero EndpointV2");
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:192", "Quote succeeded", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Redeploying OApp with official endpoint fixed the bug!"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      console.log("   Error:", e.message);
      logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:202", "Quote still fails", {
        errorSig,
        error: e.message,
        success: false
      });
    }

  } catch (e) {
    console.log("❌ Deployment failed:", e.message);
    logDebug(runId, "JJ", "redeploy-oapp-official-endpoint.js:210", "Deployment failed", {
      error: e.message
    });
  }

  console.log("\n✅ Redeployment complete. Check logs for details.");
}

main().catch(console.error);
