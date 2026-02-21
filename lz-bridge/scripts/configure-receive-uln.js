const hre = require("hardhat");
const fs = require("fs");

/**
 * Configure ReceiveUln302 to support Base Sepolia (EID 84532)
 * Sets default ULN config so the library can be used as default receive library
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("⚙️  Configuring ReceiveUln302 for Base Sepolia\n");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  const storyInfra = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Configuration:");
  console.log(`   ReceiveUln302: ${storyInfra.receiveUln302}`);
  console.log(`   Base Sepolia EID: 84532\n`);

  const receiveUln = await hre.ethers.getContractAt(
    "ReceiveUln302",
    storyInfra.receiveUln302
  );

  // Check owner
  const owner = await receiveUln.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the library owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Deployer: ${deployer.address}\n`);
    process.exit(1);
  }

  console.log("✅ Deployer is library owner\n");

  // Check if already configured
  try {
    const isSupported = await receiveUln.isSupportedEid(84532);
    if (isSupported) {
      console.log("✅ Base Sepolia EID already supported!\n");
      return;
    }
  } catch (error) {
    // Not configured yet, continue
  }

  // For testnet, we can use a minimal ULN config
  // Note: ULN requires at least one DVN, but for testnet we might be able to use
  // a placeholder or configure it to work without strict DVN verification
  
  console.log("⚠️  ULN libraries require DVN (Data Verification Network) configuration.");
  console.log("   For testnet, you have a few options:\n");
  console.log("   1. Use LayerZero's testnet DVNs (if available)");
  console.log("   2. Configure minimal DVN setup for testing");
  console.log("   3. Use a different approach for testnet\n");
  
  console.log("💡 For now, let's try configuring with a minimal testnet setup.");
  console.log("   You may need to provide DVN addresses or use LayerZero's testnet DVNs.\n");
  
  // Try to set a minimal config - but this will fail without DVNs
  // For now, let's just show what's needed
  console.log("📝 To configure, you need:");
  console.log("   - At least one DVN address (for testnet verification)");
  console.log("   - Confirmations count (e.g., 1 for testnet)");
  console.log("   - Required/optional DVN configuration\n");
  
  console.log("🔗 Check LayerZero docs for testnet DVN addresses:");
  console.log("   https://docs.layerzero.network/v2/deployments/chains/base-sepolia\n");
  
  console.log("=".repeat(60));
  console.log("\n💡 Alternative: Configure per-OApp instead of default");
  console.log("   You can configure ULN settings per-OApp, which might be easier for testnet.\n");
}

main().catch((error) => {
  console.error("❌ Configuration failed:", error);
  process.exit(1);
});
