/**
 * Final debugging summary - collect all evidence
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

  console.log("📊 Final Debugging Summary\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const testSender = signer.address;
  const dstEid = 1315;

  console.log("Contract Addresses:");
  console.log("  EndpointV2:", ownEndpoint.endpointV2);
  console.log("  SendUln302:", ownEndpoint.sendUln302);
  console.log("  ReceiveUln302:", ownEndpoint.receiveUln302);
  console.log("  Executor:", ownEndpoint.executor);
  console.log("  Test sender:", testSender);
  console.log("  Destination EID:", dstEid);
  console.log();

  // 1. Check getSendLibrary
  console.log("1. getSendLibrary():");
  const lib = await endpoint.getSendLibrary(testSender, dstEid);
  console.log("   Result:", lib);
  console.log("   Expected:", ownEndpoint.sendUln302);
  console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  logDebug(runId, "FINAL", "final-debug-summary.js:50", "getSendLibrary", {
    lib,
    expected: ownEndpoint.sendUln302,
    match: lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()
  });

  // 2. Check defaultSendLibrary
  console.log("\n2. defaultSendLibrary():");
  const defaultLib = await endpoint.defaultSendLibrary(dstEid);
  console.log("   Result:", defaultLib);
  logDebug(runId, "FINAL", "final-debug-summary.js:60", "defaultSendLibrary", {
    lib: defaultLib
  });

  // 3. Check executor config
  console.log("\n3. Executor Config:");
  const executorConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 1);
  const executorConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint32 maxMessageSize, address executor)"],
    executorConfigBytes
  )[0];
  console.log("   Executor:", executorConfig.executor);
  console.log("   Max message size:", executorConfig.maxMessageSize.toString());
  logDebug(runId, "FINAL", "final-debug-summary.js:72", "Executor config", {
    executor: executorConfig.executor,
    maxMessageSize: executorConfig.maxMessageSize.toString()
  });

  // 4. Check ULN config
  console.log("\n4. ULN Config:");
  const ulnConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 2);
  const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
    ulnConfigBytes
  )[0];
  console.log("   Required DVN count:", ulnConfig.requiredDVNCount.toString());
  console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
  console.log("   Optional DVN threshold:", ulnConfig.optionalDVNThreshold.toString());
  if (ulnConfig.optionalDVNs.length > 0) {
    console.log("   Optional DVN:", ulnConfig.optionalDVNs[0]);
  }
  logDebug(runId, "FINAL", "final-debug-summary.js:87", "ULN config", {
    requiredDVNCount: ulnConfig.requiredDVNCount.toString(),
    optionalDVNCount: ulnConfig.optionalDVNCount.toString(),
    optionalDVN: ulnConfig.optionalDVNs.length > 0 ? ulnConfig.optionalDVNs[0] : "none"
  });

  // 5. Check treasury
  console.log("\n5. Treasury:");
  const treasury = await sendUln.treasury();
  console.log("   Treasury:", treasury);
  logDebug(runId, "FINAL", "final-debug-summary.js:97", "Treasury", {
    treasury
  });

  // 6. Test quote()
  console.log("\n6. Testing quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    const fee = await endpoint.quote(messagingParams, testSender);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    logDebug(runId, "FINAL", "final-debug-summary.js:115", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() FAILED");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "FINAL", "final-debug-summary.js:124", "Quote failed", {
      errorSig,
      error: e.message,
      allChecksPassed: "All individual checks pass, but quote() still fails",
      conclusion: "Error 0x6592671c is an unknown custom error from SendUln302 or a dependency"
    });
  }

  console.log("\n✅ Summary complete. Check logs for details.");
}

main().catch(console.error);
