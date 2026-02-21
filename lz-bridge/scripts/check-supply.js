const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

/**
 * Check total supply of USDC.d on both chains
 * Verifies actual supply using correct decimals (6)
 */

async function main() {
  console.log("📊 USDC Dance (USDC.d) Total Supply Verification\n");
  console.log("=".repeat(60));

  // Load deployments
  const baseDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );

  console.log("Contract Addresses:");
  console.log(`   Base Sepolia: ${baseDeployment.address}`);
  console.log(`   Story Aeneid: ${storyDeployment.address}`);
  console.log("");

  // Get contract ABI
  const abi = (await hre.artifacts.readArtifact("USDCDanceOFT")).abi;

  // Check Base Sepolia
  console.log("🔍 Checking Base Sepolia...");
  try {
    const baseProvider = new hre.ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
    );
    const BaseOFT = new hre.ethers.Contract(
      baseDeployment.address,
      abi,
      baseProvider
    );

    const baseSupply = await BaseOFT.totalSupply();
    const baseDecimals = await BaseOFT.decimals();
    const baseName = await BaseOFT.name();
    const baseSymbol = await BaseOFT.symbol();
    
    console.log(`   Token: ${baseName} (${baseSymbol})`);
    console.log(`   Decimals: ${baseDecimals}`);
    console.log(`   Raw Supply: ${baseSupply.toString()}`);
    // Format with correct decimals (6) regardless of what contract reports
    const correctDecimals = 6;
    console.log(`   Total Supply: ${hre.ethers.formatUnits(baseSupply, correctDecimals)} ${baseSymbol} (using ${correctDecimals} decimals)`);
    console.log(`   Total Supply (as reported): ${hre.ethers.formatUnits(baseSupply, baseDecimals)} ${baseSymbol} (using ${baseDecimals} decimals)`);
    
    // Check owner balance
    const owner = await BaseOFT.owner();
    const ownerBalance = await BaseOFT.balanceOf(owner);
    console.log(`   Owner Balance: ${hre.ethers.formatUnits(ownerBalance, correctDecimals)} ${baseSymbol} (using ${correctDecimals} decimals)`);
    console.log(`   Owner Address: ${owner}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log("");

  // Check Story Aeneid
  console.log("🔍 Checking Story Aeneid...");
  try {
    const storyProvider = new hre.ethers.JsonRpcProvider(
      process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io"
    );
    const StoryOFT = new hre.ethers.Contract(
      storyDeployment.address,
      abi,
      storyProvider
    );

    const storySupply = await StoryOFT.totalSupply();
    const storyDecimals = await StoryOFT.decimals();
    const storyName = await StoryOFT.name();
    const storySymbol = await StoryOFT.symbol();
    
    console.log(`   Token: ${storyName} (${storySymbol})`);
    console.log(`   Decimals: ${storyDecimals}`);
    console.log(`   Raw Supply: ${storySupply.toString()}`);
    // Format with correct decimals (6) regardless of what contract reports
    const correctDecimals = 6;
    console.log(`   Total Supply: ${hre.ethers.formatUnits(storySupply, correctDecimals)} ${storySymbol} (using ${correctDecimals} decimals)`);
    console.log(`   Total Supply (as reported): ${hre.ethers.formatUnits(storySupply, storyDecimals)} ${storySymbol} (using ${storyDecimals} decimals)`);
    
    // Check owner balance
    const owner = await StoryOFT.owner();
    const ownerBalance = await StoryOFT.balanceOf(owner);
    console.log(`   Owner Balance: ${hre.ethers.formatUnits(ownerBalance, correctDecimals)} ${storySymbol} (using ${correctDecimals} decimals)`);
    console.log(`   Owner Address: ${owner}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n💡 Supply Information:");
  console.log("   - USDC.d has NO maximum supply cap (unlimited)");
  console.log("   - Decimals: 6 (not 18 as StoryScan may display)");
  console.log("   - Supply increases when:");
  console.log("     • Tokens are minted by owner (testnet only)");
  console.log("     • Tokens arrive via cross-chain transfer (LayerZero)");
  console.log("   - Supply decreases when:");
  console.log("     • Tokens are sent cross-chain (burned on source chain)");
  console.log("     • Tokens are burned directly");
  console.log("\n   Note: StoryScan may display incorrect values due to decimals mismatch.");
  console.log("   This script uses the correct decimals (6) from the contract.\n");
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
