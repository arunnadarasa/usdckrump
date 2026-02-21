const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  console.log("🔗 Linking OFT pair (Base Sepolia ↔ Story Aeneid)");
  
  // Load both OFT deployments
  const baseOft = JSON.parse(
    fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
  );
  const storyOft = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );
  
  console.log("Base OFT:", baseOft.address);
  console.log("Story OFT:", storyOft.address);
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  
  // Get contract instances - need to use separate providers for each network
  // First configure Base Sepolia
  console.log("\n1/2 Configuring Base OFT on Base Sepolia...");
  const baseProvider = new hre.ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
  );
  const baseSigner = new hre.ethers.Wallet(process.env.PRIVATE_KEY, baseProvider);
  const BaseOFT = new hre.ethers.Contract(
    baseOft.address,
    (await hre.artifacts.readArtifact("USDCDanceOFT")).abi,
    baseSigner
  );
  
  // Convert Story OFT address to bytes32 format (LayerZero V2 uses bytes32)
  const storyOftBytes32 = hre.ethers.zeroPadValue(storyOft.address, 32);
  
  // Get current nonce for Base Sepolia
  const baseNonce = await baseProvider.getTransactionCount(baseSigner.address, "pending");
  console.log(`   Using nonce: ${baseNonce}`);
  
  // LayerZero V2 uses setPeer(uint32 _eid, bytes32 _peer)
  const tx1 = await BaseOFT.setPeer(
    1315, // Story Aeneid EID
    storyOftBytes32,
    { nonce: baseNonce }
  );
  await tx1.wait();
  console.log("   ✅ Base OFT trusts Story OFT");
  
  // Then configure Story Aeneid
  console.log("2/2 Configuring Story OFT on Story Aeneid...");
  const storyProvider = new hre.ethers.JsonRpcProvider(
    process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io"
  );
  const storySigner = new hre.ethers.Wallet(process.env.PRIVATE_KEY, storyProvider);
  const StoryOFT = new hre.ethers.Contract(
    storyOft.address,
    (await hre.artifacts.readArtifact("USDCDanceOFT")).abi,
    storySigner
  );
  
  // Convert Base OFT address to bytes32 format (LayerZero V2 uses bytes32)
  const baseOftBytes32 = hre.ethers.zeroPadValue(baseOft.address, 32);
  
  // Get current nonce for Story Aeneid
  const storyNonce = await storyProvider.getTransactionCount(storySigner.address, "pending");
  console.log(`   Using nonce: ${storyNonce}`);
  
  // LayerZero V2 uses setPeer(uint32 _eid, bytes32 _peer)
  const tx2 = await StoryOFT.setPeer(
    84532, // Base Sepolia EID
    baseOftBytes32,
    { nonce: storyNonce }
  );
  await tx2.wait();
  console.log("   ✅ Story OFT trusts Base OFT");
  
  console.log("\n🎉 OFT pair linked!");
  console.log("\n📋 Deployment Summary:");
  console.log(`   Base USDC.d: ${baseOft.address}`);
  console.log(`   Story USDC.d: ${storyOft.address}`);
  console.log("\n✅ Ready for cross-chain transfers!");
}

main().catch((error) => {
  console.error("❌ Linking failed:", error);
  process.exit(1);
});
