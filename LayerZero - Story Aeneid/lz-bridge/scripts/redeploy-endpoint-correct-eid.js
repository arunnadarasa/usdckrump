/**
 * Redeploy EndpointV2 with the CORRECT LayerZero EID for Base Sepolia: 40245
 * (Not the chain ID 84532!)
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

  console.log("🔄 Redeploying EndpointV2 with CORRECT LayerZero EID");
  console.log("   Deployer:", deployer.address);
  console.log("   Network: Base Sepolia (Chain ID: 84532)");
  console.log("   LayerZero EID: 40245 (NOT chain ID 84532!)\n");

  // Backup current deployment
  const currentDeployment = JSON.parse(
    fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8")
  );
  
  const backupPath = `deployments/base-sepolia-own-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(currentDeployment, null, 2));
  console.log("📦 Backed up current deployment to:", backupPath);

  try {
    const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
    
    console.log("📝 Deploying EndpointV2...");
    console.log("   LayerZero EID: 40245 (Base Sepolia)");
    console.log("   Owner:", deployer.address);
    
    const endpoint = await EndpointV2.deploy(40245, deployer.address); // CORRECT EID!
    await endpoint.waitForDeployment();
    
    const endpointAddress = await endpoint.getAddress();
    console.log("\n✅ EndpointV2 deployed:", endpointAddress);
    
    // Verify deployment
    const owner = await endpoint.owner();
    const eid = await endpoint.eid();
    
    console.log("\n📋 Deployment verification:");
    console.log("   Owner:", owner);
    console.log("   EID:", eid.toString());
    console.log("   Expected EID: 40245");
    console.log("   Match:", eid === 40245n ? "✅" : "❌");
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase() || eid !== 40245n) {
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
      note: "Redeployed with CORRECT LayerZero EID 40245 (was incorrectly using chain ID 84532)",
      previousEndpoint: currentDeployment.endpointV2,
      layerZeroEid: 40245
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
    console.log("\n   This should fix the LZ_DefaultSendLibUnavailable error!");
    
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
