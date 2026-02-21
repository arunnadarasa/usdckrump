/**
 * Deploy SimpleDVN and update ULN config to use it
 * This should fix the error 0x6592671c
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

  console.log("🔧 Deploying SimpleDVN and Fixing ULN Config\n");

  try {
    // 1. Deploy SimpleDVN
    console.log("1. Deploying SimpleDVN...");
    const SimpleDVN = await hre.ethers.getContractFactory("SimpleDVN");
    const dvn = await SimpleDVN.deploy();
    await dvn.waitForDeployment();
    const dvnAddress = await dvn.getAddress();
    console.log("   ✅ SimpleDVN deployed:", dvnAddress);
    logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:45", "SimpleDVN deployed", {
      dvnAddress
    });

    // 2. Update ULN config to use SimpleDVN
    console.log("\n2. Updating ULN config to use SimpleDVN:");
    const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

    const ulnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [dvnAddress] // Use SimpleDVN instead of ReceiveUln302
    };

    const configParam = {
      eid: 1315,
      config: ulnConfig
    };

    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    await tx.wait();
    console.log("   ✅ ULN config updated");
    logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:67", "ULN config updated", {
      dvn: dvnAddress,
      eid: 1315
    });

    // 3. Test quote() after fix
    console.log("\n3. Testing quote() after DVN fix:");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    const testSender = signer.address;
    const dstEid = 1315;
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);

    const messagingParams = {
      dstEid: dstEid,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };

    logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:87", "Before quote() test", {
      dvnDeployed: true,
      ulnConfigUpdated: true
    });

    try {
      const fee = await endpoint.quote(messagingParams, testSender);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: ReceiveUln302 was used as a DVN, but it's a receive library!");
      console.log("   Solution: Deploy SimpleDVN and use it as the DVN");
      logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:100", "Quote succeeded after fix", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Deploying SimpleDVN and using it as DVN fixed the bug!",
        rootCause: "ReceiveUln302 is a receive library, not a DVN - it doesn't implement ILayerZeroDVN.getFee()",
        solution: "Deploy SimpleDVN contract that implements ILayerZeroDVN"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      console.log("   Error:", e.message);
      logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:111", "Quote still fails", {
        errorSig,
        error: e.message,
        success: false
      });
    }

  } catch (e) {
    console.log("❌ Error:", e.message);
    logDebug(runId, "Z", "deploy-dvn-and-fix-config.js:120", "Error", {
      error: e.message
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
