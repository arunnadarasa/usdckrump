const hre = require("hardhat");
const fs = require("fs");

/**
 * Configure ULN (Ultra Light Node) settings for LayerZero V2
 * This enables cross-chain messaging between Base Sepolia and Story Aeneid
 * 
 * For testnet, we can use minimal DVN configs or configure per-OApp
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("⚙️  Configuring ULN settings for Story Aeneid\n");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  // Load deployments
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Current Configuration:");
  console.log(`   EndpointV2: ${storyDeployment.endpointV2}`);
  console.log(`   SendUln302: ${storyDeployment.sendUln302}`);
  console.log(`   ReceiveUln302: ${storyDeployment.receiveUln302}`);
  console.log(`   Base Sepolia EID: 84532\n`);

  // Get contract instances
  const SendUln302 = await hre.ethers.getContractAt(
    "SendUln302",
    storyDeployment.sendUln302
  );

  const ReceiveUln302 = await hre.ethers.getContractAt(
    "ReceiveUln302",
    storyDeployment.receiveUln302
  );

  // For testnet, we can configure minimal ULN settings
  // Note: For production, you'd need actual DVN addresses
  // For now, we'll configure libraries per-OApp instead of default
  
  console.log("💡 ULN Configuration Options:\n");
  console.log("Option 1: Configure per-OApp (Recommended for testnet)");
  console.log("   - Each OApp (like USDCDanceOFT) can configure its own ULN settings");
  console.log("   - Use setConfig on the OApp contract");
  console.log("   - No default library config needed\n");
  
  console.log("Option 2: Configure default ULN settings");
  console.log("   - Requires DVN (Data Verification Network) addresses");
  console.log("   - For testnet, you can use LayerZero's testnet DVNs");
  console.log("   - Or configure minimal settings for testing\n");

  console.log("📝 Next Steps:");
  console.log("   1. For testnet testing, configure ULN per-OApp when needed");
  console.log("   2. For production, set up proper DVN infrastructure");
  console.log("   3. Configure libraries using setDefaultSendLibrary/setDefaultReceiveLibrary");
  console.log("   4. Or configure per-OApp using setSendLibrary/setReceiveLibrary\n");

  console.log("🔗 Useful Links:");
  console.log("   - LayerZero V2 Docs: https://docs.layerzero.network/v2/");
  console.log("   - ULN Configuration Guide: Check LayerZero documentation");
  console.log("\n");

  // Check if libraries are set as default
  const endpoint = await hre.ethers.getContractAt(
    "EndpointV2",
    storyDeployment.endpointV2
  );

  try {
    const defaultSendLib = await endpoint.defaultSendLibrary(84532);
    const defaultReceiveLib = await endpoint.defaultReceiveLibrary(84532);
    
    if (defaultSendLib !== "0x0000000000000000000000000000000000000000") {
      console.log("✅ Default Send Library configured for Base Sepolia:", defaultSendLib);
    } else {
      console.log("⚠️  No default Send Library configured for Base Sepolia");
    }
    
    if (defaultReceiveLib !== "0x0000000000000000000000000000000000000000") {
      console.log("✅ Default Receive Library configured for Base Sepolia:", defaultReceiveLib);
    } else {
      console.log("⚠️  No default Receive Library configured for Base Sepolia");
    }
  } catch (error) {
    console.log("⚠️  Could not check default library status:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n💡 Recommendation:");
  console.log("   For testnet, configure libraries per-OApp when you deploy USDCDanceOFT");
  console.log("   This avoids needing default library configuration");
  console.log("\n");
}

main().catch((error) => {
  console.error("❌ Configuration failed:", error);
  process.exit(1);
});
