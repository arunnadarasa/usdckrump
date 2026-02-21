/**
 * Redeploy EndpointV2 without optimization to test if compiler optimization is causing the bug
 * This is a test to see if the internal call issue is resolved with different compiler settings
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  console.log("🔄 Redeploying EndpointV2 WITHOUT optimization");
  console.log("   Deployer:", deployer.address);
  console.log("   Network: Base Sepolia (84532)\n");

  // Save current deployment
  const currentDeployment = JSON.parse(
    fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8")
  );
  
  const backupPath = `deployments/base-sepolia-own-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(currentDeployment, null, 2));
  console.log("📦 Backed up current deployment to:", backupPath);

  // Temporarily modify hardhat config to disable optimization
  // We'll need to compile with different settings
  console.log("\n⚠️  NOTE: This script requires compiling with optimization disabled");
  console.log("   You may need to modify hardhat.config.js temporarily");
  console.log("   Or compile EndpointV2 separately with: optimizer.enabled = false\n");

  // Get the contract factory
  // Note: This will use current hardhat config settings
  // To test without optimization, you need to:
  // 1. Modify hardhat.config.js: optimizer.enabled = false
  // 2. Recompile: npx hardhat clean && npx hardhat compile
  // 3. Then run this script
  
  try {
    const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
    
    console.log("📝 Deploying EndpointV2...");
    console.log("   EID: 84532");
    console.log("   Owner:", deployer.address);
    
    const endpoint = await EndpointV2.deploy(84532, deployer.address);
    await endpoint.waitForDeployment();
    
    const endpointAddress = await endpoint.getAddress();
    console.log("\n✅ EndpointV2 deployed:", endpointAddress);
    
    // Verify deployment
    const owner = await endpoint.owner();
    const eid = await endpoint.eid();
    
    console.log("\n📋 Deployment verification:");
    console.log("   Owner:", owner);
    console.log("   EID:", eid.toString());
    console.log("   Match:", owner.toLowerCase() === deployer.address.toLowerCase() && eid === 84532n);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase() || eid !== 84532n) {
      console.error("❌ Deployment verification failed!");
      process.exit(1);
    }
    
    // Save new deployment
    const newDeployment = {
      chain: "base-sepolia",
      chainId: 84532,
      endpointV2: endpointAddress,
      sendUln302: currentDeployment.sendUln302, // Keep existing libraries
      receiveUln302: currentDeployment.receiveUln302,
      executor: currentDeployment.executor,
      deployedAt: new Date().toISOString(),
      deployer: deployer.address,
      note: "Redeployed without optimization to test internal call bug fix",
      previousEndpoint: currentDeployment.endpointV2
    };
    
    fs.writeFileSync(
      "deployments/base-sepolia-own-latest.json",
      JSON.stringify(newDeployment, null, 2)
    );
    
    console.log("\n💾 Deployment saved to: deployments/base-sepolia-own-latest.json");
    console.log("\n⚠️  NEXT STEPS:");
    console.log("   1. Deploy SendUln302 and ReceiveUln302 (if not already deployed)");
    console.log("   2. Configure libraries: npx hardhat run scripts/configure-own-endpoint-libraries.js --network baseSepolia");
    console.log("   3. Set send library for OFT: npx hardhat run scripts/set-oapp-send-library.js --network baseSepolia");
    console.log("   4. Test quote(): npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia");
    console.log("\n   If this fixes the bug, the issue was compiler optimization");
    console.log("   If it doesn't, the issue is deeper (LayerZero contract bug)");
    
  } catch (e) {
    console.error("❌ Deployment failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
