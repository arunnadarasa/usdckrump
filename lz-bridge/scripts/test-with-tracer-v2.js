/**
 * Test quote() with QuoteTracerV2 to isolate exact failure point
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

  console.log("🔍 Testing quote() with QuoteTracerV2\n");

  // Deploy QuoteTracerV2 if not already deployed
  const tracerAddress = "0x0000000000000000000000000000000000000000"; // Update after deployment
  const tracer = await hre.ethers.getContractAt("QuoteTracerV2", tracerAddress);

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

  logDebug(runId, "BB", "test-with-tracer-v2.js:45", "Before traceQuoteDetailed", {
    tracer: tracerAddress
  });

  try {
    const tx = await tracer.traceQuoteDetailed(messagingParams, testSender);
    const receipt = await tx.wait();

    console.log("📊 Parsing events...\n");

    for (const event of receipt.logs) {
      try {
        const parsed = tracer.interface.parseLog(event);
        if (parsed) {
          console.log(`Event: ${parsed.name}`);
          console.log(`  Args:`, parsed.args);
          
          if (parsed.name === "LogStep") {
            const [step, success, data] = parsed.args;
            const errorSig = data.length >= 4 ? data.slice(0, 10) : "unknown";
            console.log(`  Step: ${step}, Success: ${success}`);
            if (!success) {
              console.log(`  Error signature: ${errorSig}`);
              if (errorSig === "0x6592671c") {
                console.log(`  ⚠️  THIS IS THE ERROR!`);
                logDebug(runId, "BB", "test-with-tracer-v2.js:70", "Error found in step", {
                  step,
                  errorSig,
                  confirmed: `Error originates from ${step}`
                });
              }
            }
          } else if (parsed.name === "LogFinalResult") {
            const [success, nativeFee, lzTokenFee] = parsed.args;
            console.log(`  Success: ${success}`);
            if (success) {
              console.log(`  Native fee: ${hre.ethers.formatEther(nativeFee)} ETH`);
              console.log(`  LZ token fee: ${hre.ethers.formatEther(lzTokenFee)} LZ`);
              logDebug(runId, "BB", "test-with-tracer-v2.js:84", "Quote succeeded", {
                success: true,
                nativeFee: nativeFee.toString()
              });
            } else {
              logDebug(runId, "BB", "test-with-tracer-v2.js:90", "Quote failed", {
                success: false
              });
            }
          }
          console.log();
        }
      } catch (e) {
        // Skip unparseable events
      }
    }
  } catch (e) {
    console.log("❌ Error:", e.message);
    logDebug(runId, "BB", "test-with-tracer-v2.js:102", "Error", {
      error: e.message
    });
  }

  console.log("✅ Test complete. Check logs for details.");
}

main().catch(console.error);
