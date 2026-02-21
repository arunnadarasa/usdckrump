/**
 * Check if we're using the official LayerZero EndpointV2 for Base Sepolia
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
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const runId = `run_${Date.now()}`;

  console.log("🔍 Checking Official LayerZero EndpointV2 for Base Sepolia\n");

  console.log("Current deployment endpoint:", ownEndpoint.endpointV2);
  console.log("EID:", ownEndpoint.eid || "not set");
  
  logDebug(runId, "EE", "check-official-endpoint.js:45", "Current endpoint", {
    endpoint: ownEndpoint.endpointV2,
    eid: ownEndpoint.eid
  });

  // Fetch official deployments
  console.log("\nFetching official LayerZero deployments...");
  try {
    const response = await fetch("https://metadata.layerzero-api.com/v1/metadata/deployments");
    const data = await response.json();
    
    // Find Base Sepolia
    const baseSepoliaKey = Object.keys(data).find(key => 
      key.toLowerCase().includes("base-sepolia") || 
      key.toLowerCase().includes("basesep")
    );
    
    if (baseSepoliaKey) {
      const chainData = data[baseSepoliaKey];
      console.log("\nFound Base Sepolia deployment:", baseSepoliaKey);
      
      if (chainData.deployments && Array.isArray(chainData.deployments)) {
        const v2Deployment = chainData.deployments.find(d => 
          d.version === 2 || d.endpointV2 || (d.eid && parseInt(d.eid) >= 30000)
        );
        
        if (v2Deployment && v2Deployment.endpointV2) {
          const officialEndpoint = v2Deployment.endpointV2.address || v2Deployment.endpointV2;
          console.log("\n✅ Official LayerZero EndpointV2:", officialEndpoint);
          console.log("   Official EID:", v2Deployment.eid || "not set");
          
          const isMatch = officialEndpoint.toLowerCase() === ownEndpoint.endpointV2.toLowerCase();
          console.log("\nMatch:", isMatch ? "✅ YES" : "❌ NO");
          
          if (!isMatch) {
            console.log("\n⚠️  CRITICAL ISSUE FOUND!");
            console.log("   We are using a SELF-DEPLOYED endpoint, not the official one!");
            console.log("   This explains why quote() fails - the official endpoint has");
            console.log("   default send libraries configured, but ours doesn't!");
            console.log("\n   Solution: Use the official EndpointV2:", officialEndpoint);
            
            logDebug(runId, "EE", "check-official-endpoint.js:80", "Endpoint mismatch found", {
              current: ownEndpoint.endpointV2,
              official: officialEndpoint,
              rootCause: "Using self-deployed endpoint instead of official LayerZero EndpointV2",
              solution: "Switch to official endpoint"
            });
          } else {
            console.log("\n✅ Using official endpoint!");
            logDebug(runId, "EE", "check-official-endpoint.js:88", "Using official endpoint", {
              endpoint: officialEndpoint
            });
          }
          
          // Also check other official contracts
          if (v2Deployment.sendUln302) {
            const officialSendUln = v2Deployment.sendUln302.address || v2Deployment.sendUln302;
            console.log("\nOfficial SendUln302:", officialSendUln);
            const sendUlnMatch = officialSendUln.toLowerCase() === ownEndpoint.sendUln302.toLowerCase();
            console.log("   Match:", sendUlnMatch ? "✅" : "❌");
          }
          
          if (v2Deployment.receiveUln302) {
            const officialReceiveUln = v2Deployment.receiveUln302.address || v2Deployment.receiveUln302;
            console.log("\nOfficial ReceiveUln302:", officialReceiveUln);
            const receiveUlnMatch = officialReceiveUln.toLowerCase() === ownEndpoint.receiveUln302.toLowerCase();
            console.log("   Match:", receiveUlnMatch ? "✅" : "❌");
          }
          
          if (v2Deployment.executor) {
            const officialExecutor = v2Deployment.executor.address || v2Deployment.executor;
            console.log("\nOfficial Executor:", officialExecutor);
          }
        } else {
          console.log("\n❌ Could not find V2 deployment in official data");
        }
      }
    } else {
      console.log("\n❌ Could not find Base Sepolia in official deployments");
    }
  } catch (e) {
    console.log("\n❌ Error fetching official deployments:", e.message);
    logDebug(runId, "EE", "check-official-endpoint.js:120", "Error fetching official deployments", {
      error: e.message
    });
  }

  console.log("\n✅ Check complete. Check logs for details.");
}

main().catch(console.error);
