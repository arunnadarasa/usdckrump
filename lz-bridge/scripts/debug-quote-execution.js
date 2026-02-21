/**
 * Debug script to trace quoteSend execution with HTTP logging
 * Tests all hypotheses about why quoteSend fails
 */
const hre = require("hardhat");
const fs = require("fs");

// HTTP logging function with file backup
const logPath = '/Users/openclaw/Documents/USDC Krump/.cursor/debug.log';

async function logDebug(runId, hypothesisId, location, message, data) {
  const logEntry = {
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now()
  };
  
  // Write to file (backup)
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    // Ignore file errors
  }
  
  // HTTP logging
  try {
    if (typeof fetch !== 'undefined') {
      await fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore logging errors
  }
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const runId = `debug_${Date.now()}`;
  
  console.log("🔍 Debugging quoteSend Execution");
  console.log("=".repeat(60));
  console.log("Run ID:", runId);
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  const dstEid = 1315;
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  // Create minimal Type 3 options
  function createMinimalType3Options() {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17;
    const GAS = 0n;
    
    return hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );
  }

  let extraOptions = createMinimalType3Options();
  await logDebug(runId, "ALL", "debug-quote-execution.js:60", "Options created", { 
    options: extraOptions, 
    length: extraOptions.length 
  });

  const sendParam = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: extraOptions,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  await logDebug(runId, "ALL", "debug-quote-execution.js:75", "SendParam created", sendParam);

  // Deploy QuoteTracerEnhanced if not already deployed
  console.log("1. Deploying QuoteTracerEnhanced...");
  let tracerAddress;
  try {
    const QuoteTracerEnhanced = await hre.ethers.getContractFactory("QuoteTracerEnhanced");
    const tracer = await QuoteTracerEnhanced.deploy(ownEndpoint.endpointV2, ownEndpoint.sendUln302);
    await tracer.waitForDeployment();
    tracerAddress = await tracer.getAddress();
    console.log("   ✅ Deployed:", tracerAddress);
    await logDebug(runId, "ALL", "debug-quote-execution.js:85", "Tracer deployed", { tracerAddress });
  } catch (e) {
    console.log("   ⚠️  Deployment failed, trying to use existing:", e.message);
    // Try to find existing deployment or use a known address
    tracerAddress = "0x0000000000000000000000000000000000000000"; // Will fail gracefully
  }

  const tracer = await hre.ethers.getContractAt("QuoteTracerEnhanced", tracerAddress);

  // Build the message that OFT would send
  console.log("\n2. Building OFT message...");
  try {
    // Call _buildMsgAndOptions via a test or use the actual message construction
    // For now, we'll trace the actual quoteSend call
    await logDebug(runId, "ALL", "debug-quote-execution.js:100", "Building message", {});
  } catch (e) {
    await logDebug(runId, "H5", "debug-quote-execution.js:102", "Message build failed", { error: e.message });
  }

  // Test 1: Try quoteSend directly
  console.log("\n3. Testing quoteSend directly...");
  await logDebug(runId, "ALL", "debug-quote-execution.js:107", "Testing quoteSend", {});
  try {
    const [nativeFee, lzTokenFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    await logDebug(runId, "ALL", "debug-quote-execution.js:112", "quoteSend success", { 
      nativeFee: nativeFee.toString(), 
      lzTokenFee: lzTokenFee.toString() 
    });
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    await logDebug(runId, "ALL", "debug-quote-execution.js:120", "quoteSend failed", { 
      errorSig, 
      errorMessage: error.message,
      errorData: error.data 
    });

    // Test 2: Trace via QuoteTracerEnhanced
    console.log("\n4. Tracing via QuoteTracerEnhanced...");
    
    // Build MessagingParams similar to what OFT would send
    // We need to simulate what _buildMsgAndOptions does
    // OFTMsgCodec.encode(to, amountSD, composeMsg) format:
    // [to: bytes32][amountSD: uint64][composeMsg: bytes]
    const amountReceivedLD = amount;
    const amountSD = amountReceivedLD; // For 6 decimals, SD = LD
    const composeMsg = "0x";
    
    // OFT message format: [to: bytes32][amountSD: uint64][composeMsg: bytes]
    const message = hre.ethers.solidityPacked(
      ["bytes32", "uint64", "bytes"],
      [recipient, amountSD, composeMsg]
    );

    // Get combined options (what combineOptions would return)
    const SEND = 1;
    let finalOptions = extraOptions;
    try {
      finalOptions = await proxyOft.combineOptions(dstEid, SEND, extraOptions);
      if (finalOptions === "0x" || finalOptions.length < 2) {
        finalOptions = extraOptions; // Use our Type 3 options
      }
    } catch (e) {
      // Use our Type 3 options
      finalOptions = extraOptions;
    }

    const messagingParams = {
      dstEid: dstEid,
      receiver: recipient,
      message: message,
      options: finalOptions,
      payInLzToken: false
    };
    
    await logDebug(runId, "ALL", "debug-quote-execution.js:135", "MessagingParams constructed", {
      messageLength: message.length,
      optionsLength: finalOptions.length,
      message: hre.ethers.hexlify(message),
      options: finalOptions
    });

    await logDebug(runId, "ALL", "debug-quote-execution.js:140", "Tracing quote", { messagingParams });

    try {
      // Test individual steps first
      console.log("   Testing individual steps...");
      
      // Step 1: Test getSendLibrary
      await logDebug(runId, "ALL", "debug-quote-execution.js:148", "Testing getSendLibrary", {});
      try {
        const lib = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, dstEid);
        console.log(`   ✅ getSendLibrary: ${lib}`);
        await logDebug(runId, "ALL", "debug-quote-execution.js:152", "getSendLibrary success", { lib });
      } catch (e) {
        console.log(`   ❌ getSendLibrary failed: ${e.message}`);
        await logDebug(runId, "ALL", "debug-quote-execution.js:155", "getSendLibrary failed", { error: e.message });
      }

      // Step 2: Test getConfig for ULN
      await logDebug(runId, "H1", "debug-quote-execution.js:159", "Testing ULN config", {});
      try {
        const ulnConfigBytes = await sendUln.getConfig(dstEid, proxyOftDeployment.oappProxyOft, 2);
        const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
          ["tuple(uint64,uint16,uint16,uint16,address[],address[])"],
          ulnConfigBytes
        )[0];
        console.log(`   ✅ ULN Config: confirmations=${ulnConfig[0]}, optionalDVNs=${ulnConfig[5].length}`);
        await logDebug(runId, "H1", "debug-quote-execution.js:166", "ULN config success", {
          confirmations: ulnConfig[0].toString(),
          optionalDVNCount: ulnConfig[2].toString(),
          optionalDVNs: ulnConfig[5].map(a => a.toString())
        });
        
        // Test DVN.getFee if we have DVNs
        if (ulnConfig[5].length > 0) {
          const dvn = ulnConfig[5][0];
          await logDebug(runId, "H1", "debug-quote-execution.js:173", "Testing DVN.getFee", { dvn: dvn.toString() });
          try {
            const dvnFee = await sendUln.callStatic.testDVNGetFee(dvn, dstEid, ulnConfig[0], proxyOftDeployment.oappProxyOft);
            console.log(`   ✅ DVN.getFee: ${hre.ethers.formatEther(dvnFee)} ETH`);
            await logDebug(runId, "H1", "debug-quote-execution.js:177", "DVN.getFee success", { dvn: dvn.toString(), fee: dvnFee.toString() });
          } catch (e) {
            console.log(`   ❌ DVN.getFee failed: ${e.message}`);
            await logDebug(runId, "H1", "debug-quote-execution.js:180", "DVN.getFee failed", { dvn: dvn.toString(), error: e.message, errorData: e.data });
          }
        }
      } catch (e) {
        console.log(`   ❌ ULN config failed: ${e.message}`);
        await logDebug(runId, "H1", "debug-quote-execution.js:184", "ULN config failed", { error: e.message, errorData: e.data });
      }

      // Step 3: Test getConfig for Executor
      await logDebug(runId, "H2", "debug-quote-execution.js:188", "Testing Executor config", {});
      console.log(`   Using SendUln302: ${ownEndpoint.sendUln302}`);
      console.log(`   Expected executor: ${ownEndpoint.executor}`);
      try {
        const executorConfigBytes = await sendUln.getConfig(dstEid, proxyOftDeployment.oappProxyOft, 1);
        console.log(`   Config bytes length: ${executorConfigBytes.length}`);
        console.log(`   Config bytes: ${hre.ethers.hexlify(executorConfigBytes)}`);
        
        // Try decoding with correct tuple format
        const executorConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
          ["tuple(uint32 maxMessageSize, address executor)"],
          executorConfigBytes
        )[0];
        
        const maxMessageSize = executorConfig[0];
        const executorAddr = executorConfig[1];
        
        console.log(`   ✅ Executor Config decoded:`);
        console.log(`      maxMessageSize: ${maxMessageSize}`);
        console.log(`      executor: ${executorAddr}`);
        console.log(`      Expected executor: ${ownEndpoint.executor}`);
        console.log(`      Match: ${executorAddr.toLowerCase() === ownEndpoint.executor.toLowerCase()}`);
        
        await logDebug(runId, "H2", "debug-quote-execution.js:207", "Executor config decoded", {
          maxMessageSize: maxMessageSize.toString(),
          executor: executorAddr.toString(),
          expectedExecutor: ownEndpoint.executor,
          match: executorAddr.toLowerCase() === ownEndpoint.executor.toLowerCase(),
          configBytes: hre.ethers.hexlify(executorConfigBytes)
        });
        
        // Test message size
        if (message.length > executorConfig[0]) {
          console.log(`   ❌ Message size ${message.length} exceeds max ${executorConfig[0]}`);
          await logDebug(runId, "H3", "debug-quote-execution.js:201", "Message size exceeded", {
            messageSize: message.length,
            maxSize: executorConfig[0].toString()
          });
        } else {
          console.log(`   ✅ Message size OK: ${message.length} <= ${executorConfig[0]}`);
          await logDebug(runId, "H3", "debug-quote-execution.js:206", "Message size OK", {
            messageSize: message.length,
            maxSize: executorConfig[0].toString()
          });
        }
        
        // Test Executor.getFee (executorAddr already declared above)
        if (executorAddr !== hre.ethers.ZeroAddress && executorAddr.toLowerCase() === ownEndpoint.executor.toLowerCase()) {
          await logDebug(runId, "H2", "debug-quote-execution.js:303", "Testing Executor.getFee", { executor: executorAddr.toString() });
          try {
            // Call Executor.getFee directly
            const ILayerZeroExecutor = new hre.ethers.Interface([
              "function getFee(uint32 dstEid, address sender, uint256 calldataSize, bytes calldata options) external view returns (uint256)"
            ]);
            const executorContract = new hre.ethers.Contract(executorAddr, ILayerZeroExecutor, hre.ethers.provider);
            const executorFee = await executorContract.getFee.staticCall(dstEid, proxyOftDeployment.oappProxyOft, message.length, "0x");
            console.log(`   ✅ Executor.getFee: ${hre.ethers.formatEther(executorFee)} ETH`);
            await logDebug(runId, "H2", "debug-quote-execution.js:311", "Executor.getFee success", { executor: executorAddr.toString(), fee: executorFee.toString() });
          } catch (e) {
            const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
            console.log(`   ❌ Executor.getFee failed: ${e.message}`);
            console.log(`   Error signature: ${errorSig}`);
            await logDebug(runId, "H2", "debug-quote-execution.js:316", "Executor.getFee failed", { 
              executor: executorAddr.toString(), 
              error: e.message,
              errorSig,
              errorData: e.data 
            });
          }
        } else {
          console.log(`   ⚠️  Executor address mismatch or zero!`);
          console.log(`   Config: ${executorAddr}, Expected: ${ownEndpoint.executor}`);
          await logDebug(runId, "H2", "debug-quote-execution.js:324", "Executor address mismatch", {
            configExecutor: executorAddr.toString(),
            expectedExecutor: ownEndpoint.executor,
            isZero: executorAddr === hre.ethers.ZeroAddress
          });
        }
      } catch (e) {
        console.log(`   ❌ Executor config failed: ${e.message}`);
        await logDebug(runId, "H2", "debug-quote-execution.js:223", "Executor config failed", { error: e.message, errorData: e.data });
      }

      // Step 4: Try endpoint.quote directly
      await logDebug(runId, "ALL", "debug-quote-execution.js:227", "Testing endpoint.quote", {});
      try {
        const fee = await endpoint.quote(messagingParams, proxyOftDeployment.oappProxyOft);
        console.log(`   ✅ endpoint.quote SUCCESS: ${hre.ethers.formatEther(fee.nativeFee)} ETH`);
        await logDebug(runId, "ALL", "debug-quote-execution.js:230", "endpoint.quote success", {
          nativeFee: fee.nativeFee.toString(),
          lzTokenFee: fee.lzTokenFee.toString()
        });
      } catch (e) {
        const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
        console.log(`   ❌ endpoint.quote failed: ${e.message}`);
        console.log(`   Error signature: ${errorSig}`);
        await logDebug(runId, "ALL", "debug-quote-execution.js:236", "endpoint.quote failed", {
          error: e.message,
          errorSig,
          errorData: e.data
        });
      }

      // Step 5: Try tracer if endpoint.quote failed
      console.log("\n   Attempting full trace via tracer contract...");
      await logDebug(runId, "ALL", "debug-quote-execution.js:242", "Starting tracer", {});
      
      // Call traceQuoteDetailed
      const tx = await tracer.traceQuoteDetailed(messagingParams, proxyOftDeployment.oappProxyOft);
      const receipt = await tx.wait();
      
      console.log("   ✅ Trace completed");
      await logDebug(runId, "ALL", "debug-quote-execution.js:248", "Trace completed", { 
        txHash: receipt.hash 
      });

      // Parse events from receipt
      const stepEvents = [];
      const configEvents = [];
      const feeEvents = [];
      const resultEvents = [];

      for (const log of receipt.logs) {
        try {
          const parsed = tracer.interface.parseLog(log);
          if (parsed) {
            if (parsed.name === "LogStep") {
              const [step, success, data, timestamp] = parsed.args;
              stepEvents.push({ step, success, data, timestamp: timestamp.toString() });
              console.log(`   📍 ${step}: ${success ? "✅" : "❌"}`);
              await logDebug(runId, "ALL", `tracer:${step}`, step, { 
                success, 
                data: hre.ethers.hexlify(data),
                timestamp: timestamp.toString()
              });
              
              if (!success && step.includes("failed")) {
                console.log(`      Error data: ${hre.ethers.hexlify(data)}`);
                await logDebug(runId, "ALL", `tracer:${step}:error`, "Failure detected", { 
                  errorData: hre.ethers.hexlify(data) 
                });
              }
            } else if (parsed.name === "LogUlnConfig") {
              const [confirmations, requiredDVNCount, optionalDVNCount, optionalDVNThreshold, optionalDVNs] = parsed.args;
              configEvents.push({ confirmations, requiredDVNCount, optionalDVNCount, optionalDVNThreshold, optionalDVNs });
              await logDebug(runId, "H1", "tracer:UlnConfig", "ULN Config", { 
                confirmations: confirmations.toString(),
                requiredDVNCount,
                optionalDVNCount,
                optionalDVNThreshold,
                optionalDVNs: optionalDVNs.map(a => a.toString())
              });
            } else if (parsed.name === "LogExecutorConfig") {
              const [executor, maxMessageSize] = parsed.args;
              configEvents.push({ executor, maxMessageSize });
              await logDebug(runId, "H2", "tracer:ExecutorConfig", "Executor Config", { 
                executor: executor.toString(),
                maxMessageSize: maxMessageSize.toString()
              });
            } else if (parsed.name === "LogDVNFee") {
              const [dvn, fee, success] = parsed.args;
              feeEvents.push({ dvn, fee, success });
              await logDebug(runId, "H1", "tracer:DVNFee", "DVN Fee", { 
                dvn: dvn.toString(),
                fee: fee.toString(),
                success 
              });
            } else if (parsed.name === "LogExecutorFee") {
              const [executor, fee, success] = parsed.args;
              feeEvents.push({ executor, fee, success });
              await logDebug(runId, "H2", "tracer:ExecutorFee", "Executor Fee", { 
                executor: executor.toString(),
                fee: fee.toString(),
                success 
              });
            } else if (parsed.name === "LogFinalResult") {
              const [success, nativeFee, lzTokenFee, errorData] = parsed.args;
              resultEvents.push({ success, nativeFee, lzTokenFee, errorData });
              await logDebug(runId, "ALL", "tracer:FinalResult", "Final Result", { 
                success,
                nativeFee: nativeFee.toString(),
                lzTokenFee: lzTokenFee.toString(),
                errorData: hre.ethers.hexlify(errorData)
              });
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      console.log(`\n   📊 Summary: ${stepEvents.length} steps, ${configEvents.length} configs, ${feeEvents.length} fees`);
      
      // Find the failure point
      const failedStep = stepEvents.find(e => !e.success && e.step.includes("failed"));
      if (failedStep) {
        console.log(`\n   🔴 FAILURE POINT: ${failedStep.step}`);
        await logDebug(runId, "ALL", "debug-quote-execution.js:190", "Failure point identified", failedStep);
      }

    } catch (e) {
      console.log("   ❌ Trace failed:", e.message);
      await logDebug(runId, "ALL", "debug-quote-execution.js:194", "Trace failed", { error: e.message });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Debug complete! Check logs for details.");
  console.log("=".repeat(60));
}

main().catch(async (e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
