const hre = require("hardhat");
const fs = require("fs");

/**
 * Configure OApp's receive library directly (per-OApp configuration)
 * This bypasses the need for default library configuration
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("⚙️  Configuring OApp Receive Library\n");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );
  const storyInfra = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Configuration:");
  console.log(`   OApp (USDCDanceOFT): ${storyDeployment.address}`);
  console.log(`   Endpoint: ${storyDeployment.endpoint}`);
  console.log(`   ReceiveUln302: ${storyInfra.receiveUln302}`);
  console.log(`   Base Sepolia EID: 84532\n`);

  const oft = await hre.ethers.getContractAt(
    "USDCDanceOFT",
    storyDeployment.address
  );

  // Check owner
  const owner = await oft.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the OApp owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Deployer: ${deployer.address}\n`);
    process.exit(1);
  }

  console.log("✅ Deployer is OApp owner\n");

  const endpoint = await hre.ethers.getContractAt(
    "EndpointV2",
    storyDeployment.endpoint
  );

  // Check current library
  try {
    const [currentLib, isDefault] = await endpoint.getReceiveLibrary(
      storyDeployment.address,
      84532
    );
    
    if (currentLib === storyInfra.receiveUln302) {
      console.log("✅ Receive library already configured!\n");
      return;
    }
    
    console.log(`   Current library: ${currentLib}`);
    console.log(`   Using default: ${isDefault}\n`);
  } catch (error) {
    console.log("   No library configured yet\n");
  }

  // The OApp needs to call setReceiveLibrary on the endpoint
  // But USDCDanceOFT doesn't expose this directly
  // We need to call it through the endpoint, but it needs to be authorized
  
  console.log("💡 For LayerZero V2, OApps call setReceiveLibrary through the endpoint.");
  console.log("   However, the library must support the EID first.\n");
  
  console.log("⚠️  The ReceiveUln302 library needs ULN config for Base Sepolia EID.");
  console.log("   This requires DVN (Data Verification Network) configuration.\n");
  
  console.log("📝 Next Steps:");
  console.log("   1. Configure ULN config on ReceiveUln302 for EID 84532");
  console.log("   2. Then set it as OApp's receive library");
  console.log("   3. Configure Base Sepolia's send library\n");
  
  console.log("=".repeat(60));
  console.log("\n💡 For testnet, you might need to:");
  console.log("   - Use LayerZero's testnet DVNs");
  console.log("   - Or configure a minimal testnet setup");
  console.log("   - Or use LayerZero's cross-chain configuration UI\n");
}

main().catch((error) => {
  console.error("❌ Configuration failed:", error);
  process.exit(1);
});
