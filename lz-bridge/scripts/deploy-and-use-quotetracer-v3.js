/**
 * Deploy QuoteTracerV3 and use it to trace quote() failure
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

  console.log("🔍 Deploying QuoteTracerV3 and Tracing quote()\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  // Deploy QuoteTracerV3
  console.log("1. Deploying QuoteTracerV3...");
  try {
    const QuoteTracerV3 = await hre.ethers.getContractFactory("QuoteTracerV3");
    const tracer = await QuoteTracerV3.deploy();
    await tracer.waitForDeployment();
    const tracerAddress = await tracer.getAddress();
    console.log("   ✅ QuoteTracerV3 deployed:", tracerAddress);
    logDebug(runId, "GGG", "deploy-and-use-quotetracer-v3.js:55", "QuoteTracerV3 deployed", {
      address: tracerAddress
    });
  } catch (e) {
    console.log("   ❌ Deployment failed:", e.message);
    return;
  }

  // Use tracer to trace quote()
  console.log("\n2. Tracing quote() with QuoteTracerV3:");
  const dstEid = 1315;
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  logDebug(runId, "GGG", "deploy-and-use-quotetracer-v3.js:72", "Before traceQuote", {
    endpoint: ownEndpoint.endpointV2,
    oapp: baseOft.address
  });

  try {
    const result = await tracer.traceQuote(ownEndpoint.endpointV2, messagingParams, baseOft.address);
    
    if (result.errorData.length > 0) {
      const errorSig = result.errorData.slice(0, 10);
      console.log("   ❌ quote() failed");
      console.log("   Error signature:", errorSig);
      console.log("   Error data:", result.errorData);
      logDebug(runId, "GGG", "deploy-and-use-quotetracer-v3.js:85", "Quote failed", {
        errorSig,
        errorData: result.errorData
      });
    } else {
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(result.fee.nativeFee), "ETH");
      logDebug(runId, "GGG", "deploy-and-use-quotetracer-v3.js:92", "Quote succeeded", {
        nativeFee: result.fee.nativeFee.toString()
      });
    }

    // Check events
    const filter = tracer.filters.LogStep();
    const events = await tracer.queryFilter(filter);
    console.log("\n3. Trace steps:");
    for (const event of events) {
      console.log(`   ${event.args.step}: ${event.args.success ? "✅" : "❌"}`);
      if (!event.args.success && event.args.data.length > 0) {
        const sig = event.args.data.slice(0, 10);
        console.log(`      Error: ${sig}`);
      }
    }
  } catch (e) {
    console.log("   ❌ Tracer failed:", e.message);
    logDebug(runId, "GGG", "deploy-and-use-quotetracer-v3.js:108", "Tracer failed", {
      error: e.message
    });
  }

  console.log("\n✅ Trace complete. Check logs for details.");
}

main().catch(console.error);
