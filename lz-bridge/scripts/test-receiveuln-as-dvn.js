/**
 * Test if ReceiveUln302 implements ILayerZeroDVN.getFee() correctly
 * ReceiveUln302 might not be a valid DVN - it's a receive library, not a DVN!
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

  console.log("🔍 Testing ReceiveUln302 as DVN\n");

  const receiveUln = ownEndpoint.receiveUln302;
  console.log("ReceiveUln302:", receiveUln);

  // Check if ReceiveUln302 implements ILayerZeroDVN
  console.log("\n1. Checking if ReceiveUln302 implements ILayerZeroDVN:");
  try {
    const dvnAbi = [
      "function getFee(uint32 _dstEid, uint64 _confirmations, address _sender, bytes calldata _options) external view returns (uint256)"
    ];
    const dvn = await hre.ethers.getContractAt(dvnAbi, receiveUln);
    
    logDebug(runId, "X", "test-receiveuln-as-dvn.js:45", "Before ReceiveUln302.getFee()", {
      receiveUln,
      hypothesis: "ReceiveUln302 is a receive library, not a DVN - it shouldn't implement getFee()"
    });
    
    const fee = await dvn.getFee(1315, 1n, signer.address, "0x");
    console.log("   ✅ ReceiveUln302.getFee() exists and works");
    console.log("   Fee:", fee.toString());
    logDebug(runId, "X", "test-receiveuln-as-dvn.js:54", "ReceiveUln302.getFee works", {
      fee: fee.toString(),
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ ReceiveUln302.getFee() fails:", errorSig);
    console.log("   Error:", e.message);
    
    if (errorSig === "0x6592671c") {
      console.log("   ⚠️  THIS IS THE SAME ERROR!");
      console.log("   ReceiveUln302.getFee() throws error 0x6592671c!");
      logDebug(runId, "X", "test-receiveuln-as-dvn.js:65", "ReceiveUln302.getFee has same error", {
        errorSig,
        confirmed: "Error originates from ReceiveUln302.getFee()",
        rootCause: "ReceiveUln302 is a receive library, not a DVN - it doesn't implement getFee() correctly"
      });
    } else {
      logDebug(runId, "X", "test-receiveuln-as-dvn.js:72", "ReceiveUln302.getFee different error", {
        errorSig,
        error: e.message
      });
    }
  }

  // Check ReceiveUln302's actual interface
  console.log("\n2. Checking ReceiveUln302's actual interface:");
  try {
    const receiveUlnContract = await hre.ethers.getContractAt("ReceiveUln302", receiveUln);
    console.log("   ✅ ReceiveUln302 contract loaded");
    
    // Try to call version() to verify it's the right contract
    const version = await receiveUlnContract.version();
    console.log("   Version:", version.toString());
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n💡 Insight: ReceiveUln302 is a RECEIVE library, not a DVN!");
  console.log("   DVNs are separate contracts that verify messages.");
  console.log("   ReceiveUln302 should NOT be used as a DVN in ULN config.");
  console.log("   We need to deploy or use an actual DVN contract.");

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
