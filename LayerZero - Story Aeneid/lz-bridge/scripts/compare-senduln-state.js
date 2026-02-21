/**
 * Compare state of old vs new SendUln302 to find missing configuration
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

  console.log("🔍 Comparing Old vs New SendUln302 State\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const oldSendUln = "0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355";
  const newSendUln = ownEndpoint.sendUln302;
  const dstEid = 1315;
  const DEFAULT_CONFIG = hre.ethers.ZeroAddress;

  console.log("Old SendUln302:", oldSendUln);
  console.log("New SendUln302:", newSendUln);
  console.log();

  const oldContract = await hre.ethers.getContractAt("SendUln302", oldSendUln);
  const newContract = await hre.ethers.getContractAt("SendUln302", newSendUln);

  // Compare key state variables
  console.log("1. Comparing state variables:");
  
  try {
    const oldTreasury = await oldContract.treasury();
    const newTreasury = await newContract.treasury();
    console.log("   Treasury - Old:", oldTreasury, "New:", newTreasury);
    console.log("   Match?", oldTreasury === newTreasury ? "✅ YES" : "❌ NO");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  try {
    const oldEndpointAddr = await oldContract.endpoint();
    const newEndpointAddr = await newContract.endpoint();
    console.log("   Endpoint - Old:", oldEndpointAddr, "New:", newEndpointAddr);
    console.log("   Match?", oldEndpointAddr.toLowerCase() === newEndpointAddr.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Compare ULN configs
  console.log("\n2. Comparing ULN configs:");
  try {
    const oldUlnConfig = await oldContract.getUlnConfig(DEFAULT_CONFIG, dstEid);
    const newUlnConfig = await newContract.getUlnConfig(DEFAULT_CONFIG, dstEid);
    
    console.log("   Old - Optional DVN count:", oldUlnConfig.optionalDVNCount.toString());
    console.log("   New - Optional DVN count:", newUlnConfig.optionalDVNCount.toString());
    console.log("   Match?", oldUlnConfig.optionalDVNCount === newUlnConfig.optionalDVNCount ? "✅ YES" : "❌ NO");
    
    if (oldUlnConfig.optionalDVNs.length > 0 && newUlnConfig.optionalDVNs.length > 0) {
      const oldDvn = oldUlnConfig.optionalDVNs[0];
      const newDvn = newUlnConfig.optionalDVNs[0];
      console.log("   Old DVN:", oldDvn);
      console.log("   New DVN:", newDvn);
      console.log("   DVN Match?", oldDvn.toLowerCase() === newDvn.toLowerCase() ? "✅ YES" : "❌ NO");
    }
    
    logDebug(runId, "PPP", "compare-senduln-state.js:85", "ULN config comparison", {
      oldOptionalDVNCount: oldUlnConfig.optionalDVNCount.toString(),
      newOptionalDVNCount: newUlnConfig.optionalDVNCount.toString(),
      matches: oldUlnConfig.optionalDVNCount === newUlnConfig.optionalDVNCount
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Compare executor configs
  console.log("\n3. Comparing executor configs:");
  try {
    const oldExecutorConfig = await oldContract.getExecutorConfig(DEFAULT_CONFIG, dstEid);
    const newExecutorConfig = await newContract.getExecutorConfig(DEFAULT_CONFIG, dstEid);
    
    console.log("   Old - Executor:", oldExecutorConfig.executor);
    console.log("   New - Executor:", newExecutorConfig.executor);
    console.log("   Executor Match?", oldExecutorConfig.executor.toLowerCase() === newExecutorConfig.executor.toLowerCase() ? "✅ YES" : "❌ NO");
    
    console.log("   Old - Max message size:", oldExecutorConfig.maxMessageSize.toString());
    console.log("   New - Max message size:", newExecutorConfig.maxMessageSize.toString());
    console.log("   Max size Match?", oldExecutorConfig.maxMessageSize === newExecutorConfig.maxMessageSize ? "✅ YES" : "❌ NO");
    
    logDebug(runId, "PPP", "compare-senduln-state.js:103", "Executor config comparison", {
      oldExecutor: oldExecutorConfig.executor,
      newExecutor: newExecutorConfig.executor,
      oldMaxSize: oldExecutorConfig.maxMessageSize.toString(),
      newMaxSize: newExecutorConfig.maxMessageSize.toString()
    });
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote() on both
  console.log("\n4. Testing quote() on both:");
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const eid = await endpoint.eid();
  const nonce = await endpoint.outboundNonce(baseOft.address, dstEid, hre.ethers.zeroPadValue(signer.address, 32));
  
  function generateGUID(nonce, srcEid, sender, dstEid, receiver) {
    return hre.ethers.solidityPackedKeccak256(
      ["uint64", "uint32", "address", "uint32", "bytes32"],
      [nonce, srcEid, sender, dstEid, receiver]
    );
  }
  
  const packet = {
    nonce: nonce + 1n,
    srcEid: Number(eid),
    sender: baseOft.address,
    dstEid: dstEid,
    receiver: hre.ethers.zeroPadValue(signer.address, 32),
    guid: generateGUID(nonce + 1n, Number(eid), baseOft.address, dstEid, hre.ethers.zeroPadValue(signer.address, 32)),
    message: "0x"
  };

  console.log("   Testing old SendUln302:");
  try {
    const fee = await oldContract.quote(packet, "0x", false);
    console.log("   ✅ Old SendUln302.quote() works!");
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Old SendUln302.quote() fails:", errorSig);
  }

  console.log("   Testing new SendUln302:");
  try {
    const fee = await newContract.quote(packet, "0x", false);
    console.log("   ✅ New SendUln302.quote() works!");
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ New SendUln302.quote() fails:", errorSig);
  }

  console.log("\n✅ Comparison complete. Check logs for details.");
}

main().catch(console.error);
