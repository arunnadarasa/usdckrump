/**
 * Test if we can configure the official SendUln302 to support Story Aeneid
 * Hypothesis NN: Official SendUln302 might allow configuration even if not initially supported
 * Hypothesis OO: We might be able to use OApp-level config without library registration
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

  console.log("Testing Official SendUln302 Configuration\n");

  const OFFICIAL_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const OFFICIAL_SEND_ULN = "0xC1868e054425D378095A003EcbA3823a5D0135C9";
  const OFFICIAL_EXECUTOR = "0x8A3D588D9f6AC041476b094f97FF94ec30169d3D";
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  const oappAddress = baseOft.address;
  const dstEid = 1315;

  const endpoint = await hre.ethers.getContractAt("EndpointV2", OFFICIAL_ENDPOINT);
  const officialSendUln = await hre.ethers.getContractAt("SendUln302", OFFICIAL_SEND_ULN);

  // Hypothesis NN: Check if official SendUln302 has owner/admin functions to add EID support
  console.log("Hypothesis NN: Official SendUln302 might have admin functions\n");
  
  console.log("1. Checking official SendUln302 owner:");
  try {
    const owner = await officialSendUln.owner();
    console.log("   Owner:", owner);
    console.log("   Our address:", signer.address);
    const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
    console.log("   Are we owner?", isOwner ? "✅ YES" : "❌ NO");
    logDebug(runId, "NN", "test-official-senduln-config.js:70", "Official SendUln302 owner", {
      owner,
      ourAddress: signer.address,
      isOwner
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check if there's a way to configure default ULN config
  console.log("\n2. Checking default ULN config for EID 1315:");
  try {
    const defaultConfig = await officialSendUln.defaultUlnConfig(dstEid);
    console.log("   Default config exists:", defaultConfig.confirmations > 0n ? "✅ YES" : "❌ NO");
    console.log("   Confirmations:", defaultConfig.confirmations.toString());
    logDebug(runId, "NN", "test-official-senduln-config.js:85", "Default ULN config", {
      confirmations: defaultConfig.confirmations.toString(),
      exists: defaultConfig.confirmations > 0n
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
    logDebug(runId, "NN", "test-official-senduln-config.js:91", "Error checking default config", {
      error: e.message
    });
  }

  // Hypothesis OO: Try setting OApp-level config directly without library registration
  console.log("\nHypothesis OO: Try OApp-level config without library registration\n");
  
  console.log("3. Checking if we can set config via endpoint.setConfig:");
  try {
    // Try to set executor config directly
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

    logDebug(runId, "OO", "test-official-senduln-config.js:115", "Before setConfig", {
      oapp: oappAddress,
      sendLibrary: OFFICIAL_SEND_ULN
    });

    const tx = await endpoint.setConfig(oappAddress, OFFICIAL_SEND_ULN, [executorConfigParam]);
    await tx.wait();
    console.log("   ✅ Config set successfully!");
    logDebug(runId, "OO", "test-official-senduln-config.js:125", "Config set successfully", {
      success: true
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Error:", e.message);
    console.log("   Error signature:", errorSig);
    logDebug(runId, "OO", "test-official-senduln-config.js:132", "Error setting config", {
      error: e.message,
      errorSig
    });
  }

  // Try quote() after config
  console.log("\n4. Testing quote() after config:");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "OO", "test-official-senduln-config.js:148", "Before quote() test", {
    endpoint: OFFICIAL_ENDPOINT,
    oapp: oappAddress
  });

  try {
    const fee = await endpoint.quote(messagingParams, oappAddress);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
    console.log("\n   🎉 SOLUTION FOUND!");
    logDebug(runId, "OO", "test-official-senduln-config.js:159", "Quote succeeded", {
      success: true,
      nativeFee: fee.nativeFee.toString(),
      lzTokenFee: fee.lzTokenFee.toString()
    });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
    logDebug(runId, "OO", "test-official-senduln-config.js:167", "Quote still fails", {
      errorSig,
      error: e.message,
      success: false
    });
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
