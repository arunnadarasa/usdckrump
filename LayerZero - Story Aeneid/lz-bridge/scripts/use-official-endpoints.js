// Script to create deployment files using LayerZero's official testnet endpoints
// This avoids deploying our own LayerZero infrastructure

const fs = require("fs");

// LayerZero V2 Official Testnet Endpoints
// Base Sepolia: https://docs.layerzero.network/v2/deployments/chains/base-sepolia
// Note: Story Aeneid doesn't have official endpoints, so we'll need to deploy our own

const deployments = {
  "base-sepolia": {
    chain: "base-sepolia",
    chainId: 84532,
    endpointV2: "0x6EDCE65403992e310A62460808c4b910D972f10f", // Official Base Sepolia endpoint
    // Note: For testnets, LayerZero provides pre-deployed infrastructure
    deployedAt: new Date().toISOString(),
    note: "Using LayerZero official testnet endpoint"
  },
  "story-aeneid": {
    chain: "story-aeneid",
    chainId: 1315,
    endpointV2: null, // Will need to deploy our own or use custom endpoint
    deployedAt: new Date().toISOString(),
    note: "Custom chain - endpoint needs to be deployed or configured"
  }
};

// Create deployments directory
fs.mkdirSync("deployments", { recursive: true });

// Save Base Sepolia deployment
fs.writeFileSync(
  "deployments/base-sepolia-latest.json",
  JSON.stringify(deployments["base-sepolia"], null, 2)
);
console.log("✅ Created base-sepolia-latest.json with official endpoint");

// For Story Aeneid, we'll need to deploy or configure endpoint separately
console.log("\n⚠️  Story Aeneid endpoint needs to be configured separately");
console.log("   Options:");
console.log("   1. Deploy your own LayerZero infrastructure");
console.log("   2. Use a custom endpoint if Story provides one");
console.log("   3. Configure cross-chain manually");
