/**
 * Test quote() using QuoteTracer to see events and trace execution
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const tracerDeployment = JSON.parse(fs.readFileSync("deployments/base-sepolia-quote-tracer.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Tracing quote() with QuoteTracer\n");

  const tracer = await hre.ethers.getContractAt("QuoteTracer", tracerDeployment.quoteTracer);

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

  console.log("Calling traceQuote()...");
  console.log("Sender:", testSender);
  console.log("DstEid:", dstEid);
  console.log("\n");

  try {
    // Call traceQuote() - this will emit events
    const tx = await tracer.traceQuote(messagingParams, testSender);
    const receipt = await tx.wait();

    // Parse events
    console.log("📊 Events from traceQuote():");
    for (const log of receipt.logs) {
      try {
        const parsed = tracer.interface.parseLog(log);
        if (parsed) {
          console.log(`\n   ${parsed.name}:`);
          if (parsed.name === "LogGetSendLibrary") {
            console.log(`     sender: ${parsed.args.sender}`);
            console.log(`     dstEid: ${parsed.args.dstEid.toString()}`);
            console.log(`     lib: ${parsed.args.lib}`);
          } else if (parsed.name === "LogDefaultSendLibrary") {
            console.log(`     dstEid: ${parsed.args.dstEid.toString()}`);
            console.log(`     lib: ${parsed.args.lib}`);
          } else if (parsed.name === "LogIsDefault") {
            console.log(`     isDefault: ${parsed.args.isDefault}`);
          } else if (parsed.name === "LogQuoteResult") {
            console.log(`     success: ${parsed.args.success}`);
            if (!parsed.args.success) {
              console.log(`     error data: ${parsed.args.data}`);
            }
          } else {
            // Fallback: show all args
            parsed.args.forEach((arg, idx) => {
              console.log(`     arg${idx}: ${arg}`);
            });
          }
        }
      } catch (e) {
        // Skip logs that aren't from our contract
      }
    }

    // Check if quote succeeded
    const quoteResultEvent = receipt.logs.find(log => {
      try {
        const parsed = tracer.interface.parseLog(log);
        return parsed && parsed.name === "LogQuoteResult";
      } catch {
        return false;
      }
    });

    if (quoteResultEvent) {
      const parsed = tracer.interface.parseLog(quoteResultEvent);
      if (parsed.args.success) {
        console.log("\n   ✅ quote() SUCCEEDED!");
      } else {
        console.log("\n   ❌ quote() FAILED");
        console.log("   Error data:", parsed.args.data);
        const errorSig = parsed.args.data.slice(0, 10);
        console.log("   Error signature:", errorSig);
        if (errorSig === "0x6592671c") {
          console.log("   This is LZ_DefaultSendLibUnavailable()");
        }
      }
    }
  } catch (e) {
    console.log("❌ Error calling traceQuote():", e.message);
  }

  console.log("\n✅ Trace complete");
}

main().catch(console.error);
