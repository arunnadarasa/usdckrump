const hre = require("hardhat");
const fs = require("fs");

/**
 * Configure ULN libraries for cross-chain transfers
 * - Base Sepolia: Configure send library for Story Aeneid (EID 1315)
 * - Story Aeneid: Configure receive library for Base Sepolia (EID 84532)
 */

async function main() {
  console.log("⚙️  Configuring ULN Libraries for Cross-Chain Transfers\n");
  console.log("=".repeat(60));

  // Load deployments
  const baseDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );
  const storyInfra = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(`Network: ${(await hre.ethers.provider.getNetwork()).name}\n`);

  // For Base Sepolia, we need to use LayerZero's official ULN libraries
  // For Story Aeneid, we use our custom ReceiveUln302
  
  console.log("📋 Configuration Plan:");
  console.log(`   1. Base Sepolia OFT → Configure send library for EID 1315`);
  console.log(`   2. Story Aeneid OFT → Configure receive library for EID 84532`);
  console.log(`      Using: ${storyInfra.receiveUln302}\n`);

  // Check current network
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId === 84532n) {
    // Configure Base Sepolia
    console.log("🔧 Configuring Base Sepolia...\n");
    
    const baseOFT = await hre.ethers.getContractAt(
      "USDCDanceOFT",
      baseDeployment.address
    );

    const baseEndpoint = await hre.ethers.getContractAt(
      "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
      baseDeployment.endpoint
    );

    // Check if default libraries exist
    const defaultSendLib = await baseEndpoint.defaultSendLibrary(1315);
    
    if (defaultSendLib !== "0x0000000000000000000000000000000000000000") {
      console.log(`✅ Default send library found: ${defaultSendLib}`);
      console.log("   OApp will use default library automatically\n");
    } else {
      console.log("⚠️  No default send library for EID 1315");
      console.log("   Need to configure OApp-specific library\n");
      console.log("💡 For Base Sepolia, you may need to:");
      console.log("   1. Use LayerZero's official ULN libraries");
      console.log("   2. Or configure via LayerZero's UI/dashboard");
      console.log("   3. Check: https://docs.layerzero.network/v2/deployments/chains/base-sepolia\n");
    }

  } else if (network.chainId === 1315n) {
    // Configure Story Aeneid
    console.log("🔧 Configuring Story Aeneid...\n");
    
    const storyOFT = await hre.ethers.getContractAt(
      "USDCDanceOFT",
      storyDeployment.address
    );

    const storyEndpoint = await hre.ethers.getContractAt(
      "EndpointV2",
      storyDeployment.endpoint
    );

    // Check current receive library
    try {
      const [currentLib, isDefault] = await storyEndpoint.getReceiveLibrary(
        storyDeployment.address,
        84532
      );
      
      if (currentLib !== "0x0000000000000000000000000000000000000000") {
        console.log(`✅ Receive library already configured: ${currentLib}`);
        console.log(`   Using default: ${isDefault}\n`);
      } else {
        console.log("⚠️  No receive library configured");
        console.log(`   Configuring: ${storyInfra.receiveUln302}\n`);
        
        // Configure receive library
        console.log("📤 Setting receive library...");
        const tx = await storyEndpoint.setReceiveLibrary(
          storyDeployment.address,
          84532, // Base Sepolia EID
          storyInfra.receiveUln302,
          0 // No grace period for testnet
        );
        
        console.log(`   Transaction: ${tx.hash}`);
        console.log("   Waiting for confirmation...\n");
        
        await tx.wait();
        console.log("✅ Receive library configured!\n");
      }
    } catch (error) {
      console.error(`❌ Error configuring receive library: ${error.message}\n`);
      
      if (error.message.includes("LZ_DefaultReceiveLibUnavailable")) {
        console.log("💡 Need to set default receive library first:");
        console.log(`   Run as owner: setDefaultReceiveLibrary(84532, ${storyInfra.receiveUln302}, 0)\n`);
      }
    }

  } else {
    console.error(`❌ This script must be run on Base Sepolia (84532) or Story Aeneid (1315)`);
    console.log(`   Current network: ${network.name} (${network.chainId})\n`);
    process.exit(1);
  }

  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Configuration failed:", error);
  process.exit(1);
});
