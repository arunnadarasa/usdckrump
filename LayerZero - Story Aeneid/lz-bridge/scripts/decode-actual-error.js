/**
 * Decode the actual error 0x6592671c
 * This error signature doesn't match LZ_DefaultSendLibUnavailable()
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

  console.log("🔍 Decoding Actual Error: 0x6592671c\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const errorSig = "0x6592671c";

  // Collect all possible errors from the codebase
  const allErrors = [
    // Protocol errors
    "LZ_DefaultSendLibUnavailable()",
    "LZ_DefaultReceiveLibUnavailable()",
    "LZ_UnsupportedEid()",
    "LZ_OnlySendLib()",
    "LZ_OnlyReceiveLib()",
    "LZ_Unauthorized()",
    "LZ_InvalidArgument()",
    "LZ_InvalidNonce(uint64)",
    "LZ_InvalidAmount(uint256,uint256)",
    "LZ_OnlyRegisteredLib()",
    "LZ_OnlyRegisteredOrDefaultLib()",
    "LZ_OnlyNonDefaultLib()",
    "LZ_PathNotInitializable()",
    "LZ_PathNotVerifiable()",
    "LZ_InvalidPayloadHash()",
    "LZ_SendReentrancy()",
    "LZ_NotImplemented()",
    "LZ_LzTokenUnavailable()",
    "LZ_InvalidReceiveLibrary()",
    "LZ_InvalidExpiry()",
    "LZ_AlreadyRegistered()",
    "LZ_SameValue()",
    "LZ_PayloadHashNotFound(bytes32,bytes32)",
    "LZ_ComposeNotFound(bytes32,bytes32)",
    "LZ_ComposeExists()",
    "LZ_InsufficientFee(uint256,uint256,uint256,uint256)",
    "LZ_ZeroLzTokenFee()",
    "LZ_UnsupportedInterface()",
    
    // ULN errors
    "LZ_ULN_Unsorted()",
    "LZ_ULN_InvalidRequiredDVNCount()",
    "LZ_ULN_InvalidOptionalDVNCount()",
    "LZ_ULN_AtLeastOneDVN()",
    "LZ_ULN_InvalidOptionalDVNThreshold()",
    "LZ_ULN_InvalidConfirmations()",
    "LZ_ULN_UnsupportedEid(uint32)",
    "LZ_ULN_InvalidConfigType(uint32)",
    
    // MessageLib errors
    "LZ_MessageLib_InvalidMessageSize(uint256,uint256)",
    "LZ_MessageLib_InvalidAmount(uint256,uint256)",
    "LZ_MessageLib_TransferFailed()",
    "LZ_MessageLib_InvalidExecutor()",
    "LZ_MessageLib_ZeroMessageSize()",
    "LZ_MessageLib_OnlyEndpoint()",
    
    // Executor errors
    "Executor_NoOptions()",
    "Executor_ZeroLzReceiveGasProvided()",
    "Executor_ZeroLzComposeGasProvided()",
    "Executor_ZeroCalldataSizeProvided()",
    "Executor_EidNotSupported(uint32)",
    "Executor_UnsupportedOptionType(uint8)",
    
    // Worker errors
    "Worker_NotAllowed()",
    "Worker_OnlyMessageLib()",
    "Worker_RoleRenouncingDisabled()",
    
    // Treasury errors
    "LZ_Treasury_LzTokenNotEnabled()",
    
    // PriceFeed errors
    "LZ_PriceFeed_OnlyPriceUpdater()",
  ];

  console.log("1. Calculating error signatures:");
  const errorMap = new Map();
  for (const error of allErrors) {
    const sig = hre.ethers.id(error).slice(0, 10).toLowerCase();
    errorMap.set(sig, error);
    if (sig === errorSig.toLowerCase()) {
      console.log(`   ✅ MATCH FOUND: ${error}`);
      logDebug(runId, "O", "decode-actual-error.js:95", "Error match found", {
        errorSig,
        errorName: error,
        confirmed: true
      });
    }
  }

  if (!errorMap.has(errorSig.toLowerCase())) {
    console.log(`   ❌ No match found for ${errorSig}`);
    console.log(`   This might be a custom error or from a different contract`);
    logDebug(runId, "O", "decode-actual-error.js:103", "No match found", {
      errorSig,
      possibleSources: ["Custom error", "Different contract", "Deployed contract mismatch"]
    });
  }

  // Try to decode using the endpoint's interface
  console.log("\n2. Attempting to decode using EndpointV2 interface:");
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

  try {
    await endpoint.quote(messagingParams, testSender);
  } catch (e) {
    if (e.data) {
      const actualSig = e.data.slice(0, 10);
      console.log(`   Error signature: ${actualSig}`);
      
      // Try to parse with all known errors
      const errorInterface = new hre.ethers.Interface(
        allErrors.map(e => `error ${e}`)
      );
      
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log(`   ✅ Decoded error: ${decoded.name}`);
        console.log(`   Args:`, decoded.args);
        logDebug(runId, "O", "decode-actual-error.js:135", "Error decoded", {
          errorName: decoded.name,
          args: decoded.args.map(a => a.toString())
        });
      } catch (parseError) {
        console.log(`   ❌ Could not decode with known errors`);
        console.log(`   Full error data: ${e.data}`);
        logDebug(runId, "O", "decode-actual-error.js:142", "Decode failed", {
          errorData: e.data,
          parseError: parseError.message
        });
        
        // Check if it's a panic error
        if (e.data.startsWith("0x4e487b71")) {
          console.log(`   This might be a Solidity panic error`);
        }
      }
    }
  }

  // Check if error comes from SendUln302
  console.log("\n3. Checking SendUln302 for custom errors:");
  try {
    const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
    // Try calling quote directly to see if error comes from there
    const nonce = await endpoint.outboundNonce(testSender, dstEid, recipient);
    const srcEid = await endpoint.eid();
    
    const packet = {
      nonce: nonce + 1n,
      srcEid: Number(srcEid),
      sender: testSender,
      dstEid: dstEid,
      receiver: recipient,
      guid: hre.ethers.zeroPadValue("0x", 32),
      message: "0x"
    };
    
    try {
      await sendUln.quote(packet, "0x", false);
    } catch (e2) {
      if (e2.data) {
        const sig2 = e2.data.slice(0, 10);
        console.log(`   SendUln302.quote() error signature: ${sig2}`);
        if (sig2 === errorSig) {
          console.log(`   ✅ Error originates from SendUln302!`);
          logDebug(runId, "O", "decode-actual-error.js:175", "Error from SendUln302", {
            confirmed: true
          });
        }
      }
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  console.log("\n✅ Decoding complete. Check logs for details.");
}

main().catch(console.error);
