/**
 * Fix executor config for OAppProxyOFT
 * The executor address in config is wrong, causing quoteSend to fail
 */
const hre = require("hardhat");
const fs = require("fs");

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
  
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    // Ignore file errors
  }
  
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
  const runId = `fix_executor_${Date.now()}`;
  
  console.log("🔧 Fixing Executor Config");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  const dstEid = 1315;

  // Verify endpoint owner
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  console.log("📋 Current Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Expected Executor:", ownEndpoint.executor);
  console.log("   Destination EID:", dstEid, "\n");

  // Check current executor config
  console.log("1. Checking current executor config...");
  await logDebug(runId, "H2", "fix-executor-config.js:60", "Checking current config", {});
  try {
    const currentConfigBytes = await sendUln.getConfig(dstEid, proxyOftDeployment.oappProxyOft, 1);
    const currentConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      currentConfigBytes
    )[0];
    
    console.log("   Current maxMessageSize:", currentConfig[0].toString());
    console.log("   Current executor:", currentConfig[1]);
    console.log("   Expected executor:", ownEndpoint.executor);
    console.log("   Match:", currentConfig[1].toLowerCase() === ownEndpoint.executor.toLowerCase() ? "✅" : "❌");
    
    await logDebug(runId, "H2", "fix-executor-config.js:72", "Current config", {
      maxMessageSize: currentConfig[0].toString(),
      executor: currentConfig[1].toString(),
      expectedExecutor: ownEndpoint.executor,
      match: currentConfig[1].toLowerCase() === ownEndpoint.executor.toLowerCase()
    });

    if (currentConfig[1].toLowerCase() === ownEndpoint.executor.toLowerCase()) {
      console.log("\n   ✅ Executor config is already correct!");
      return;
    }
  } catch (e) {
    console.log("   ⚠️  Failed to check config:", e.message);
    await logDebug(runId, "H2", "fix-executor-config.js:84", "Check failed", { error: e.message });
  }

  // Set executor config correctly
  console.log("\n2. Setting executor config...");
  await logDebug(runId, "H2", "fix-executor-config.js:89", "Setting executor config", {
    executor: ownEndpoint.executor,
    maxMessageSize: 10000
  });

  const executorConfig = {
    maxMessageSize: 10000,
    executor: ownEndpoint.executor
  };

  const executorConfigParam = {
    eid: dstEid,
    configType: 1, // CONFIG_TYPE_EXECUTOR
    config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      [[executorConfig.maxMessageSize, executorConfig.executor]]
    )
  };

  console.log("   Config bytes:", hre.ethers.hexlify(executorConfigParam.config));
  console.log("   Encoded executor:", executorConfig.executor);
  
  await logDebug(runId, "H2", "fix-executor-config.js:110", "Config encoded", {
    configBytes: hre.ethers.hexlify(executorConfigParam.config),
    executor: executorConfig.executor
  });

  try {
    const tx = await endpoint.setConfig(proxyOftDeployment.oappProxyOft, ownEndpoint.sendUln302, [executorConfigParam]);
    const receipt = await tx.wait();
    console.log("   ✅ Executor config set");
    console.log("   Transaction:", receipt.hash);
    await logDebug(runId, "H2", "fix-executor-config.js:118", "Config set", { txHash: receipt.hash });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Failed to set executor config:", e.message);
    console.log("   Error signature:", errorSig);
    await logDebug(runId, "H2", "fix-executor-config.js:123", "Set failed", {
      error: e.message,
      errorSig,
      errorData: e.data
    });
    process.exit(1);
  }

  // Verify the config was set correctly
  console.log("\n3. Verifying executor config...");
  await logDebug(runId, "H2", "fix-executor-config.js:131", "Verifying config", {});
  try {
    const verifyConfigBytes = await sendUln.getConfig(dstEid, proxyOftDeployment.oappProxyOft, 1);
    const verifyConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      verifyConfigBytes
    )[0];
    
    console.log("   Verified maxMessageSize:", verifyConfig[0].toString());
    console.log("   Verified executor:", verifyConfig[1]);
    console.log("   Expected executor:", ownEndpoint.executor);
    console.log("   Match:", verifyConfig[1].toLowerCase() === ownEndpoint.executor.toLowerCase() ? "✅" : "❌");
    
    await logDebug(runId, "H2", "fix-executor-config.js:143", "Config verified", {
      maxMessageSize: verifyConfig[0].toString(),
      executor: verifyConfig[1].toString(),
      expectedExecutor: ownEndpoint.executor,
      match: verifyConfig[1].toLowerCase() === ownEndpoint.executor.toLowerCase()
    });

    if (verifyConfig[1].toLowerCase() !== ownEndpoint.executor.toLowerCase()) {
      console.log("\n   ❌ Config still incorrect!");
      console.log("   This suggests the config wasn't set properly.");
      await logDebug(runId, "H2", "fix-executor-config.js:151", "Config still incorrect", {});
      process.exit(1);
    }
  } catch (e) {
    console.log("   ❌ Failed to verify:", e.message);
    await logDebug(runId, "H2", "fix-executor-config.js:156", "Verify failed", { error: e.message });
  }

  // Test quoteSend
  console.log("\n4. Testing quoteSend...");
  await logDebug(runId, "ALL", "fix-executor-config.js:161", "Testing quoteSend", {});
  
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

  const SEND = 1;
  let extraOptions = createMinimalType3Options();
  try {
    const combined = await proxyOft.combineOptions(dstEid, SEND, "0x");
    if (combined !== "0x" && combined.length >= 2) {
      extraOptions = combined;
    }
  } catch (e) {
    // Use Type 3 options
  }

  const sendParam = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: extraOptions,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    await logDebug(runId, "ALL", "fix-executor-config.js:200", "quoteSend success", {
      nativeFee: nativeFee.toString()
    });
    console.log("\n   🎉 Executor config fixed and quoteSend works!");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend still failed:", error.message);
    console.log("   Error signature:", errorSig);
    await logDebug(runId, "ALL", "fix-executor-config.js:208", "quoteSend still failed", {
      error: error.message,
      errorSig,
      errorData: error.data
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Fix complete!");
  console.log("=".repeat(60));
}

main().catch(async (e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
