/**
 * Test calling the DVN contract directly to see if it throws error 0x6592671c
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

  console.log("🔍 Testing DVN Contract Directly\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const testSender = signer.address;
  const dstEid = 1315;

  // Get ULN config to find DVN address
  const ulnConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 2);
  const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    ulnConfigBytes
  )[0];

  if (ulnConfig.optionalDVNs.length === 0) {
    console.log("❌ No DVNs in config");
    return;
  }

  const dvnAddress = ulnConfig.optionalDVNs[0];
  console.log("DVN Address:", dvnAddress);
  console.log("Confirmations:", ulnConfig.confirmations.toString());
  console.log("Optional DVN threshold:", ulnConfig.optionalDVNThreshold.toString());

  // Try to get DVN interface
  console.log("\n1. Testing DVN.getFee() directly:");
  try {
    // ILayerZeroDVN interface
    const dvnAbi = [
      "function getFee(uint32 _dstEid, uint64 _confirmations, address _sender, bytes calldata _options) external view returns (uint256)"
    ];
    const dvn = await hre.ethers.getContractAt(dvnAbi, dvnAddress);
    
    logDebug(runId, "V", "test-dvn-contract-direct.js:60", "Before DVN.getFee()", {
      dvn: dvnAddress,
      dstEid,
      confirmations: ulnConfig.confirmations.toString()
    });
    
    const fee = await dvn.getFee(dstEid, ulnConfig.confirmations, testSender, "0x");
    console.log("   ✅ DVN.getFee() works");
    console.log("   Fee:", fee.toString());
    logDebug(runId, "V", "test-dvn-contract-direct.js:69", "DVN.getFee works", {
      fee: fee.toString(),
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ DVN.getFee() fails:", errorSig);
    console.log("   Error:", e.message);
    
    if (errorSig === "0x6592671c") {
      console.log("   ⚠️  THIS IS THE SAME ERROR!");
      console.log("   The error originates from DVN.getFee()!");
      logDebug(runId, "V", "test-dvn-contract-direct.js:80", "DVN.getFee has same error", {
        errorSig,
        confirmed: "Error originates from DVN.getFee()",
        rootCause: "DVN contract throws error 0x6592671c"
      });
    } else {
      logDebug(runId, "V", "test-dvn-contract-direct.js:87", "DVN.getFee different error", {
        errorSig,
        error: e.message
      });
    }
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
