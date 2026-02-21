/**
 * Debug what address is passed as _sender to EndpointV2.quote()
 * The issue: getSendLibrary() works when called directly but fails during quote()
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
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  const runId = `run_${Date.now()}`;

  console.log("🔍 Debugging quote() sender address\n");

  // Hypothesis: The _sender parameter in quote() might be different from baseOft.address
  // OFT's quoteSend() calls endpoint.quote() with _sender = address(this) (the OFT contract)
  // But we've been testing with baseOft.address directly

  console.log("1. Checking addresses:");
  console.log("   OFT address:", baseOft.address);
  console.log("   Signer address:", signer.address);

  logDebug(runId, "H", "debug-quote-sender.js:45", "Address check", {
    oftAddress: baseOft.address,
    signerAddress: signer.address
  });

  // Test getSendLibrary with OFT address (what quote() would use)
  console.log("\n2. Testing getSendLibrary() with OFT address:");
  const lib1 = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("   Library:", lib1);
  logDebug(runId, "H", "debug-quote-sender.js:55", "getSendLibrary with OFT address", {
    sender: baseOft.address,
    eid: 1315,
    lib: lib1
  });

  // Test getSendLibrary with signer address (what we might have been using?)
  console.log("\n3. Testing getSendLibrary() with signer address:");
  const lib2 = await endpoint.getSendLibrary(signer.address, 1315);
  console.log("   Library:", lib2);
  logDebug(runId, "H", "debug-quote-sender.js:65", "getSendLibrary with signer address", {
    sender: signer.address,
    eid: 1315,
    lib: lib2
  });

  // Check what OFT's quoteSend actually does
  // It should call endpoint.quote() with _sender = address(this) (the OFT)
  console.log("\n4. Testing OFT.quoteSend() to see what sender it uses:");
  
  const recipient = signer.address;
  const recipientBytes32 = hre.ethers.zeroPadValue(recipient, 32);
  const amount = hre.ethers.parseUnits("0.1", 6);

  const sendParam = {
    dstEid: 1315,
    to: recipientBytes32,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    // Try to trace what happens
    // We can't easily trace, but we can check if the issue is address-related
    
    // First, verify the library is set for OFT address
    const lib3 = await endpoint.getSendLibrary(baseOft.address, 1315);
    logDebug(runId, "H", "debug-quote-sender.js:95", "Before quoteSend", {
      lib: lib3,
      isZero: lib3 === "0x0000000000000000000000000000000000000000"
    });
    
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   ✅ Success!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee));
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      logDebug(runId, "H", "debug-quote-sender.js:110", "quoteSend error", {
        errorSig,
        isLZ_DefaultSendLibUnavailable: errorSig === "0x6592671c"
      });
      
      if (errorSig === "0x6592671c") {
        console.log("   This is LZ_DefaultSendLibUnavailable()");
        console.log("   This means getSendLibrary(_sender, 1315) returned 0 during quote()");
        console.log("   Where _sender should be:", baseOft.address);
        
        // Double-check getSendLibrary right after the error
        const lib4 = await endpoint.getSendLibrary(baseOft.address, 1315);
        logDebug(runId, "H", "debug-quote-sender.js:120", "After quoteSend error", {
          lib: lib4,
          isZero: lib4 === "0x0000000000000000000000000000000000000000",
          contradiction: "getSendLibrary works outside quote() but fails inside"
        });
        console.log("   But getSendLibrary() still returns:", lib4);
      }
    }
  }

  console.log("\n📋 Analysis complete. Check logs for details.");
}

main().catch(console.error);
