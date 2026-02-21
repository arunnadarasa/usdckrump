const hre = require("hardhat");
const fs = require("fs");

/**
 * Test script to verify bridge configuration
 * Checks contract deployments and peer linking
 */

async function main() {
  console.log("🧪 Testing LayerZero Bridge Configuration\n");
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

  console.log("📋 Deployment Status:\n");

  // Check Base Sepolia
  console.log("Base Sepolia (84532):");
  console.log(`  ✅ USDCDanceOFT: ${baseDeployment.address}`);
  console.log(`  ✅ Endpoint: ${baseDeployment.endpoint}\n`);

  // Check Story Aeneid
  console.log("Story Aeneid (1315):");
  console.log(`  ✅ USDCDanceOFT: ${storyDeployment.address}`);
  console.log(`  ✅ EndpointV2: ${storyInfra.endpointV2}`);
  console.log(`  ✅ SendUln302: ${storyInfra.sendUln302}`);
  console.log(`  ✅ ReceiveUln302: ${storyInfra.receiveUln302}\n`);

  // Test peer linking
  console.log("🔗 Testing Peer Linking:\n");

  try {
    const baseNetwork = await hre.ethers.provider.getNetwork();
    
    if (baseNetwork.chainId === 84532n) {
      const BaseOFT = await hre.ethers.getContractAt(
        "USDCDanceOFT",
        baseDeployment.address
      );
      
      const peer = await BaseOFT.peers(1315);
      const expectedPeer = hre.ethers.zeroPadValue(storyDeployment.address, 32);
      
      if (peer === expectedPeer) {
        console.log("  ✅ Base Sepolia → Story Aeneid: Linked correctly");
      } else {
        console.log("  ❌ Base Sepolia → Story Aeneid: Not linked");
        console.log(`     Expected: ${expectedPeer}`);
        console.log(`     Got: ${peer}`);
      }
    } else {
      console.log("  ⚠️  Run on Base Sepolia to test peer linking");
    }
  } catch (error) {
    console.log("  ⚠️  Could not verify peer linking:", error.message);
  }

  // Test Story Aeneid peer
  try {
    const storyNetwork = await hre.ethers.provider.getNetwork();
    
    if (storyNetwork.chainId === 1315n) {
      const StoryOFT = await hre.ethers.getContractAt(
        "USDCDanceOFT",
        storyDeployment.address
      );
      
      const peer = await StoryOFT.peers(84532);
      const expectedPeer = hre.ethers.zeroPadValue(baseDeployment.address, 32);
      
      if (peer === expectedPeer) {
        console.log("  ✅ Story Aeneid → Base Sepolia: Linked correctly");
      } else {
        console.log("  ❌ Story Aeneid → Base Sepolia: Not linked");
        console.log(`     Expected: ${expectedPeer}`);
        console.log(`     Got: ${peer}`);
      }
    } else {
      console.log("  ⚠️  Run on Story Aeneid to test peer linking");
    }
  } catch (error) {
    console.log("  ⚠️  Could not verify peer linking:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📝 Next Steps:");
  console.log("  1. Configure ULN settings: npm run configure:uln");
  console.log("  2. Test cross-chain transfer (requires ULN config)");
  console.log("  3. Test EVVM integration");
  console.log("\n");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
