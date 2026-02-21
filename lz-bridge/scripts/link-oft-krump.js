const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

/**
 * Link USDCKrumpOFT pair (Base Sepolia ↔ Story Aeneid).
 * Deploy both OFTs first, then run this script.
 */
async function main() {
  console.log("🔗 Linking USDC Krump OFT pair (Base Sepolia ↔ Story Aeneid)");

  const baseOft = JSON.parse(
    fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8")
  );
  const storyOft = JSON.parse(
    fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8")
  );

  console.log("   Base USDC.k OFT:", baseOft.address);
  console.log("   Story USDC.k OFT:", storyOft.address);

  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY required in .env");
  }

  const baseProvider = new hre.ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
  );
  const storyProvider = new hre.ethers.JsonRpcProvider(
    process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io"
  );

  const baseSigner = new hre.ethers.Wallet(process.env.PRIVATE_KEY, baseProvider);
  const storySigner = new hre.ethers.Wallet(process.env.PRIVATE_KEY, storyProvider);

  const artifact = await hre.artifacts.readArtifact("USDCKrumpOFT");

  const BaseOFT = new hre.ethers.Contract(baseOft.address, artifact.abi, baseSigner);
  const StoryOFT = new hre.ethers.Contract(storyOft.address, artifact.abi, storySigner);

  const storyOftBytes32 = hre.ethers.zeroPadValue(storyOft.address, 32);
  const baseOftBytes32 = hre.ethers.zeroPadValue(baseOft.address, 32);

  console.log("\n1/2 Setting peer on Base Sepolia...");
  const tx1 = await BaseOFT.setPeer(1315, storyOftBytes32);
  await tx1.wait();
  console.log("   ✅ Base USDC.k OFT → Story peer set");

  console.log("2/2 Setting peer on Story Aeneid...");
  const tx2 = await StoryOFT.setPeer(84532, baseOftBytes32);
  await tx2.wait();
  console.log("   ✅ Story USDC.k OFT → Base peer set");

  console.log("\n🎉 USDC Krump OFT pair linked.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
