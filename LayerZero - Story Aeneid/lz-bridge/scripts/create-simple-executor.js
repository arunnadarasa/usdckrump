/**
 * Create a simple executor contract that implements ILayerZeroExecutor
 * This executor will return 0 fee for quote() calls
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

  console.log("🔧 Creating Simple Executor\n");

  // Create a simple executor contract
  const executorCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroExecutor } from "./contracts/layerzero-infra/messagelib/interfaces/ILayerZeroExecutor.sol";

contract SimpleExecutor is ILayerZeroExecutor {
    function getFee(uint32 /*_dstEid*/, address /*_sender*/, uint256 /*_calldataSize*/, bytes calldata /*_options*/) external pure override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
    
    function assignJob(uint32 /*_dstEid*/, address /*_sender*/, uint256 /*_calldataSize*/, bytes calldata /*_options*/) external pure override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
}
`;

  // Write to temporary file
  const tempFile = "contracts/temp/SimpleExecutor.sol";
  fs.mkdirSync("contracts/temp", { recursive: true });
  fs.writeFileSync(tempFile, executorCode);

  try {
    console.log("1. Compiling SimpleExecutor...");
    await hre.run("compile");
    console.log("   ✅ Compiled");

    console.log("\n2. Deploying SimpleExecutor...");
    const SimpleExecutor = await hre.ethers.getContractFactory("SimpleExecutor");
    const executor = await SimpleExecutor.deploy();
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();
    console.log("   ✅ SimpleExecutor deployed:", executorAddress);
    logDebug(runId, "R", "create-simple-executor.js:60", "Executor deployed", {
      executorAddress
    });

    // Update deployment file
    ownEndpoint.executor = executorAddress;
    fs.writeFileSync(
      "deployments/base-sepolia-own-latest.json",
      JSON.stringify(ownEndpoint, null, 2)
    );

    console.log("\n3. Setting default executor config on SendUln302...");
    const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

    const executorConfig = {
      maxMessageSize: 10000, // 10KB
      executor: executorAddress
    };

    const configParam = {
      eid: 1315, // Story Aeneid
      config: executorConfig
    };

    const tx = await sendUln.setDefaultExecutorConfigs([configParam]);
    await tx.wait();
    console.log("   ✅ Default executor config set");
    logDebug(runId, "R", "create-simple-executor.js:85", "Executor config set", {
      executor: executorAddress,
      maxMessageSize: executorConfig.maxMessageSize,
      eid: 1315
    });

    // Test quote() after setting executor config
    console.log("\n4. Testing quote() after executor config fix:");
    const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
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
      const fee = await endpoint.quote(messagingParams, testSender);
      console.log("   ✅ quote() SUCCEEDED!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 BUG FIXED!");
      console.log("   The issue was: Executor config was not set");
      logDebug(runId, "R", "create-simple-executor.js:115", "Quote succeeded after fix", {
        success: true,
        nativeFee: fee.nativeFee.toString(),
        lzTokenFee: fee.lzTokenFee.toString(),
        fixConfirmed: "Setting executor config fixed the bug!"
      });
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() still fails:", errorSig);
      logDebug(runId, "R", "create-simple-executor.js:123", "Quote still fails", {
        errorSig,
        success: false
      });
    }

  } catch (e) {
    console.log("❌ Error:", e.message);
    logDebug(runId, "R", "create-simple-executor.js:130", "Error", {
      error: e.message
    });
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  console.log("\n✅ Test complete. Check logs for details.");
}

main().catch(console.error);
