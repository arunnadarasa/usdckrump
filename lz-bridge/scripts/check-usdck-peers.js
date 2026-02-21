const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));

  const baseOftContract = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const storyOftContract = await hre.ethers.getContractAt("USDCKrumpOFT", storyOft.address);

  console.log("🔗 Checking USDCKrumpOFT peer configuration\n");
  console.log("Base OFT:", baseOft.address);
  console.log("Story OFT:", storyOft.address, "\n");

  const basePeer = await baseOftContract.peers(1315);
  const storyPeer = await storyOftContract.peers(84532);

  const expectedBasePeer = hre.ethers.zeroPadValue(storyOft.address, 32);
  const expectedStoryPeer = hre.ethers.zeroPadValue(baseOft.address, 32);

  console.log("Base → Story peer:", basePeer);
  console.log("Expected:", expectedBasePeer);
  console.log("Match:", basePeer.toLowerCase() === expectedBasePeer.toLowerCase() ? "✅" : "❌");
  console.log("\nStory → Base peer:", storyPeer);
  console.log("Expected:", expectedStoryPeer);
  console.log("Match:", storyPeer.toLowerCase() === expectedStoryPeer.toLowerCase() ? "✅" : "❌");
}

main().catch(console.error);
