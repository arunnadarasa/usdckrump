/**
 * Redeploy SendUln302 with current compiler settings to fix bytecode mismatch
 * This should resolve the 0x6592671c error
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

  console.log("🔧 Redeploying SendUln302 with Current Compiler Settings\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  console.log("1. Deploying SendUln302...");
  logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:50", "Before deployment", {
    endpoint: ownEndpoint.endpointV2,
    localEid: ownEndpoint.layerZeroEid
  });

  try {
    const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
    const sendUln = await SendUln302.deploy(
      ownEndpoint.endpointV2,
      50000, // treasuryGasLimit
      1000000000000000000n // treasuryNativeFeeCap (1 ETH)
    );
    await sendUln.waitForDeployment();
    const sendUlnAddress = await sendUln.getAddress();
    
    console.log("   ✅ SendUln302 deployed:", sendUlnAddress);
    console.log("   Old address:", ownEndpoint.sendUln302);
    
    logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:67", "SendUln302 deployed", {
      newAddress: sendUlnAddress,
      oldAddress: ownEndpoint.sendUln302
    });

    // Update deployment file
    ownEndpoint.sendUln302 = sendUlnAddress;
    ownEndpoint.deployedAt = new Date().toISOString();
    ownEndpoint.note = "Redeployed SendUln302 to fix bytecode mismatch causing error 0x6592671c";
    fs.writeFileSync("deployments/base-sepolia-own-latest.json", JSON.stringify(ownEndpoint, null, 2));
    console.log("\n   ✅ Deployment file updated");

    // Register with endpoint
    console.log("\n2. Registering SendUln302 with EndpointV2...");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    const tx1 = await endpoint.registerLibrary(sendUlnAddress);
    await tx1.wait();
    console.log("   ✅ SendUln302 registered");

    // Set as default send library for EID 1315
    console.log("\n3. Setting as default send library for Story Aeneid (EID 1315)...");
    const tx2 = await endpoint.setDefaultSendLibrary(1315, sendUlnAddress);
    await tx2.wait();
    console.log("   ✅ Default send library set");

    // Test quote() with new SendUln302
    console.log("\n4. Testing quote() with new SendUln302...");
    const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);
    const messagingParams = {
      dstEid: 1315,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };

    logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:100", "Before quote() test", {
      endpoint: ownEndpoint.endpointV2,
      oapp: baseOft.address,
      newSendUln: sendUlnAddress
    });

    try {
      const fee = await endpoint.quote(messagingParams, baseOft.address);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: Bytecode mismatch - deployed contract compiled with different settings");
      console.log("   Solution: Redeployed SendUln302 with current compiler settings");
      logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:113", "Quote succeeded", {
        nativeFee: fee.nativeFee.toString(),
        success: true,
        fixConfirmed: "Redeploying SendUln302 fixed the bug!"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      console.log("   Error:", e.message);
      logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:122", "Quote still fails", {
        errorSig,
        error: e.message,
        success: false
      });
    }

  } catch (e) {
    console.log("   ❌ Deployment failed:", e.message);
    logDebug(runId, "MMM", "redeploy-senduln302-fixed.js:130", "Deployment failed", {
      error: e.message
    });
  }

  console.log("\n✅ Redeployment complete. Check logs for details.");
}

main().catch(console.error);
