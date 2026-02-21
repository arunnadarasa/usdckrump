/**
 * Redeploy EndpointV2 with different compiler settings to test if that fixes the bug
 * Tests: 1) No optimization, 2) No viaIR, 3) Different Solidity version
 * 
 * IMPORTANT: Before running, modify hardhat.config.js:
 *   Option 1: optimizer.enabled = false
 *   Option 2: viaIR = false
 *   Option 3: version = "0.8.19" or "0.8.21"
 * Then: npx hardhat clean && npx hardhat compile
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  console.log("🔄 Redeploying EndpointV2 with Different Compiler Settings");
  console.log("   Deployer:", deployer.address);
  console.log("   Network: Base Sepolia (84532)\n");

  // Check current compiler settings
  const config = hre.config.solidity;
  console.log("📋 Current Compiler Settings:");
  console.log("   Version:", config.version);
  console.log("   Optimizer enabled:", config.settings?.optimizer?.enabled);
  console.log("   Optimizer runs:", config.settings?.optimizer?.runs);
  console.log("   viaIR:", config.settings?.viaIR);
  console.log();

  // Backup current deployment
  const currentDeployment = JSON.parse(
    fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8")
  );
  
  const backupPath = `deployments/base-sepolia-own-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(currentDeployment, null, 2));
  console.log("📦 Backed up current deployment to:", backupPath);

  try {
    const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
    
    console.log("\n📝 Deploying EndpointV2...");
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
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase() || eid !== 84532n) {
      console.error("❌ Deployment verification failed!");
      process.exit(1);
    }
    
    // Save new deployment
    const newDeployment = {
      chain: "base-sepolia",
      chainId: 84532,
      endpointV2: endpointAddress,
      sendUln302: currentDeployment.sendUln302,
      receiveUln302: currentDeployment.receiveUln302,
      executor: currentDeployment.executor,
      deployedAt: new Date().toISOString(),
      deployer: deployer.address,
      note: `Redeployed with compiler settings: version=${config.version}, optimizer=${config.settings?.optimizer?.enabled}, viaIR=${config.settings?.viaIR}`,
      previousEndpoint: currentDeployment.endpointV2,
      compilerSettings: {
        version: config.version,
        optimizer: config.settings?.optimizer?.enabled,
        runs: config.settings?.optimizer?.runs,
        viaIR: config.settings?.viaIR
      }
    };
    
    fs.writeFileSync(
      "deployments/base-sepolia-own-latest.json",
      JSON.stringify(newDeployment, null, 2)
    );
    
    console.log("\n💾 Deployment saved");
    console.log("\n⚠️  NEXT STEPS:");
    console.log("   1. Configure libraries: npx hardhat run scripts/configure-own-endpoint-libraries.js --network baseSepolia");
    console.log("   2. Set send library for OFT: npx hardhat run scripts/set-oapp-send-library.js --network baseSepolia");
    console.log("   3. Test quote(): npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia");
    console.log("\n   If quote() works, the issue was compiler settings");
    console.log("   If it still fails, try different compiler settings or contact LayerZero");
    
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
