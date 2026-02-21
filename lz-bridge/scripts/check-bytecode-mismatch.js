/**
 * Check if deployed SendUln302 bytecode matches compiled source
 * Hypothesis LLL: Deployed bytecode might have different error signatures
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

  console.log("🔍 Checking Bytecode Mismatch\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  // Get deployed bytecode
  console.log("1. Fetching deployed bytecode:");
  const deployedCode = await hre.ethers.provider.getCode(ownEndpoint.sendUln302);
  console.log("   Deployed bytecode length:", deployedCode.length);
  console.log("   First 100 chars:", deployedCode.slice(0, 100));
  
  // Get compiled bytecode
  console.log("\n2. Getting compiled bytecode:");
  const SendUln302Factory = await hre.ethers.getContractFactory("SendUln302");
  const compiledCode = SendUln302Factory.bytecode;
  console.log("   Compiled bytecode length:", compiledCode.length);
  console.log("   First 100 chars:", compiledCode.slice(0, 100));
  
  // Compare
  console.log("\n3. Comparing bytecode:");
  const match = deployedCode.toLowerCase() === compiledCode.toLowerCase();
  console.log("   Bytecode matches?", match ? "✅ YES" : "❌ NO");
  
  if (!match) {
    console.log("\n   ⚠️  BYTECODE MISMATCH DETECTED!");
    console.log("   This explains why the error signature doesn't match source code");
    console.log("   The deployed contract may have been compiled with different settings");
  }
  
  logDebug(runId, "LLL", "check-bytecode-mismatch.js:65", "Bytecode comparison", {
    deployedLength: deployedCode.length,
    compiledLength: compiledCode.length,
    matches: match
  });

  // Try to find error signature in bytecode
  console.log("\n4. Searching for error signature in bytecode:");
  const errorSig = "6592671c";
  const deployedHasError = deployedCode.toLowerCase().includes(errorSig);
  const compiledHasError = compiledCode.toLowerCase().includes(errorSig);
  
  console.log("   Error signature in deployed bytecode?", deployedHasError ? "✅ YES" : "❌ NO");
  console.log("   Error signature in compiled bytecode?", compiledHasError ? "✅ YES" : "❌ NO");
  
  if (deployedHasError && !compiledHasError) {
    console.log("\n   ⚠️  ERROR SIGNATURE FOUND IN DEPLOYED BUT NOT IN COMPILED!");
    console.log("   This confirms the deployed contract has different bytecode");
  }
  
  logDebug(runId, "LLL", "check-bytecode-mismatch.js:81", "Error signature search", {
    errorSig,
    inDeployed: deployedHasError,
    inCompiled: compiledHasError
  });

  // Check compiler settings
  console.log("\n5. Checking compiler settings:");
  const config = await hre.config;
  console.log("   Solidity version:", config.solidity?.version || "unknown");
  console.log("   Optimization:", config.solidity?.settings?.optimizer?.enabled ? "enabled" : "disabled");
  if (config.solidity?.settings?.optimizer?.enabled) {
    console.log("   Runs:", config.solidity.settings.optimizer.runs || "unknown");
  }
  
  logDebug(runId, "LLL", "check-bytecode-mismatch.js:93", "Compiler settings", {
    version: config.solidity?.version || "unknown",
    optimization: config.solidity?.settings?.optimizer?.enabled || false,
    runs: config.solidity?.settings?.optimizer?.runs || "unknown"
  });

  console.log("\n✅ Bytecode check complete. Check logs for details.");
}

main().catch(console.error);
