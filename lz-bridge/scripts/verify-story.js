const hre = require("hardhat");
const fs = require("fs");

/**
 * Verification helper script for Story Aeneid contracts
 * 
 * This script helps verify contracts on StoryScan (aeneid.storyscan.io)
 * Run this after deploying contracts to get verification commands.
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("📋 Story Aeneid Contract Verification Helper\n");
  console.log("=" .repeat(60));
  
  // Load deployments
  let storyDeployment = null;
  let usdcDeployment = null;
  
  try {
    storyDeployment = JSON.parse(
      fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
    );
  } catch (e) {
    console.log("⚠️  No LayerZero infrastructure deployment found");
  }
  
  try {
    usdcDeployment = JSON.parse(
      fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
    );
  } catch (e) {
    console.log("⚠️  No USDCDanceOFT deployment found");
  }

  console.log("\n🔍 Contract Addresses:\n");
  
  if (storyDeployment) {
    console.log("LayerZero Infrastructure:");
    console.log(`  EndpointV2:     ${storyDeployment.endpointV2}`);
    console.log(`  SendUln302:    ${storyDeployment.sendUln302}`);
    console.log(`  ReceiveUln302: ${storyDeployment.receiveUln302}`);
    if (storyDeployment.executor !== "0x0000000000000000000000000000000000000000") {
      console.log(`  Executor:       ${storyDeployment.executor}`);
    }
  }
  
  if (usdcDeployment) {
    console.log("\nUSDCDanceOFT:");
    console.log(`  USDCDanceOFT:   ${usdcDeployment.address}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📝 Verification Instructions:\n");
  
  console.log("1. Go to StoryScan: https://aeneid.storyscan.io");
  console.log("2. Navigate to each contract address");
  console.log("3. Click 'Verify & Publish' button");
  console.log("4. Use the following settings:\n");
  
  console.log("   Compiler Version: v0.8.20");
  console.log("   EVM Version: paris");
  console.log("   Optimization: Yes");
  console.log("   Runs: 200");
  console.log("   License: MIT (for USDCDanceOFT) or LZBL-1.2 (for LayerZero contracts)\n");
  
  console.log("5. Upload the contract source code\n");
  
  if (storyDeployment) {
    console.log("=".repeat(60));
    console.log("\n🔗 Quick Links:\n");
    console.log(`EndpointV2:`);
    console.log(`  https://aeneid.storyscan.io/address/${storyDeployment.endpointV2}#code\n`);
    console.log(`SendUln302:`);
    console.log(`  https://aeneid.storyscan.io/address/${storyDeployment.sendUln302}#code\n`);
    console.log(`ReceiveUln302:`);
    console.log(`  https://aeneid.storyscan.io/address/${storyDeployment.receiveUln302}#code\n`);
  }
  
  if (usdcDeployment) {
    console.log(`USDCDanceOFT:`);
    console.log(`  https://aeneid.storyscan.io/address/${usdcDeployment.address}#code\n`);
  }

  console.log("=".repeat(60));
  console.log("\n💡 Tips:");
  console.log("- Make sure all contract files are in the correct directory structure");
  console.log("- For LayerZero contracts, you may need to flatten the contract");
  console.log("- Use 'Flatten Source Code' option if verification fails");
  console.log("- Check that constructor arguments match deployment");
  console.log("\n✅ After verification, contracts will display:");
  console.log("   - Author credits (Asura aka Angel of Indian Krump)");
  console.log("   - Website link (https://asura.lovable.app/)");
  console.log("   - StreetKode Fam Initiative credits");
  console.log("   - Full NatSpec documentation\n");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
