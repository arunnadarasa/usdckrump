/**
 * Fix ULN config - the DVN address is from Story Aeneid, not Base Sepolia!
 * We need to use a DVN that exists on Base Sepolia
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

  console.log("🔧 Fixing ULN Config - DVN Address Issue\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const dstEid = 1315;

  // Check current config
  console.log("1. Checking current ULN config:");
  const currentConfigBytes = await sendUln.getConfig(1315, "0x0000000000000000000000000000000000000000", 2);
  const currentConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    currentConfigBytes
  )[0];
  
  console.log("   Current optional DVN:", currentConfig.optionalDVNs[0]);
  console.log("   This is Story Aeneid's ReceiveUln302 (wrong chain!)");
  
  logDebug(runId, "W", "fix-uln-config-dvn.js:50", "Current config issue", {
    dvnAddress: currentConfig.optionalDVNs[0],
    issue: "DVN address is from Story Aeneid, not Base Sepolia"
  });

  // For now, let's try removing DVNs or using Base Sepolia's own ReceiveUln302
  // Actually, for testing, we can use Base Sepolia's ReceiveUln302 as the DVN
  console.log("\n2. Fixing ULN config to use Base Sepolia's ReceiveUln302:");
  const baseReceiveUln = ownEndpoint.receiveUln302;
  console.log("   Using Base Sepolia ReceiveUln302:", baseReceiveUln);
  
  const fixedUlnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [baseReceiveUln] // Use Base Sepolia's ReceiveUln302 instead
  };

  const configParam = {
    eid: 1315,
    config: fixedUlnConfig
  };

  try {
    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    await tx.wait();
    console.log("   ✅ ULN config fixed");
    logDebug(runId, "W", "fix-uln-config-dvn.js:75", "ULN config fixed", {
      newDVN: baseReceiveUln,
      eid: 1315
    });

    // Test quote() after fix
    console.log("\n3. Testing quote() after ULN config fix:");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
    const testSender = signer.address;
    const recipient = hre.ethers.zeroPadValue(signer.address, 32);

    const messagingParams = {
      dstEid: dstEid,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };

    logDebug(runId, "W", "fix-uln-config-dvn.js:95", "Before quote() test", {
      ulnConfigFixed: true
    });

    try {
      const fee = await endpoint.quote(messagingParams, testSender);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: DVN address was from Story Aeneid (wrong chain)");
      console.log("   Solution: Use Base Sepolia's ReceiveUln302 as DVN");
      logDebug(runId, "W", "fix-uln-config-dvn.js:108", "Quote succeeded after fix", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Fixing ULN config DVN address fixed the bug!",
        rootCause: "DVN address was from Story Aeneid chain, not Base Sepolia"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      logDebug(runId, "W", "fix-uln-config-dvn.js:117", "Quote still fails", {
        errorSig,
        success: false
      });
    }
  } catch (e) {
    console.log("   ❌ Failed to fix ULN config:", e.message);
    logDebug(runId, "W", "fix-uln-config-dvn.js:124", "Fix failed", {
      error: e.message
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
