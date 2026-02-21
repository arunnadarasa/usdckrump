/**
 * Fix ULN config by removing DVNs
 * ReceiveUln302 is NOT a DVN - it's a receive library!
 * For testing, we can remove DVNs from the config
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

  console.log("🔧 Fixing ULN Config - Removing DVNs\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const dstEid = 1315;

  // Set ULN config with NO DVNs (for testing)
  // Note: This might cause _assertAtLeastOneDVN to fail, but let's test
  console.log("1. Setting ULN config with NO DVNs:");
  const ulnConfigNoDvns = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 0,
    optionalDVNThreshold: 0,
    requiredDVNs: [],
    optionalDVNs: []
  };

  const configParam = {
    eid: 1315,
    config: ulnConfigNoDvns
  };

  try {
    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    await tx.wait();
    console.log("   ✅ ULN config set (no DVNs)");
    logDebug(runId, "Y", "fix-uln-config-no-dvns.js:55", "ULN config set no DVNs", {
      eid: 1315,
      hypothesis: "Removing DVNs might fix the error"
    });

    // Test quote() after removing DVNs
    console.log("\n2. Testing quote() after removing DVNs:");
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

    logDebug(runId, "Y", "fix-uln-config-no-dvns.js:75", "Before quote() test", {
      dvnsRemoved: true
    });

    try {
      const fee = await endpoint.quote(messagingParams, testSender);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   Root cause: ReceiveUln302 was used as a DVN, but it's not a DVN!");
      console.log("   Solution: Remove DVNs from ULN config (or use actual DVN contracts)");
      logDebug(runId, "Y", "fix-uln-config-no-dvns.js:88", "Quote succeeded after fix", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Removing DVNs fixed the bug!",
        rootCause: "ReceiveUln302 is a receive library, not a DVN - it doesn't implement ILayerZeroDVN.getFee()"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      console.log("   Error:", e.message);
      
      if (errorSig === "0xce2c3751") {
        console.log("   This is LZ_ULN_AtLeastOneDVN() - expected when no DVNs");
        logDebug(runId, "Y", "fix-uln-config-no-dvns.js:100", "Quote fails with AtLeastOneDVN", {
          errorSig,
          expected: "This error is expected when no DVNs are configured"
        });
      } else {
        logDebug(runId, "Y", "fix-uln-config-no-dvns.js:106", "Quote still fails", {
          errorSig,
          success: false
        });
      }
    }
  } catch (e) {
    console.log("   ❌ Failed to set ULN config:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    logDebug(runId, "Y", "fix-uln-config-no-dvns.js:116", "Set config failed", {
      error: e.message,
      errorSig: e.data ? e.data.slice(0, 10) : null
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
