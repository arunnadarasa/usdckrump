const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  
  const baseProvider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
  const baseOftContract = new hre.ethers.Contract(
    baseOft.address,
    (await hre.artifacts.readArtifact("USDCKrumpOFT")).abi,
    baseProvider
  );

  try {
    const peer = await baseOftContract.peers(1315);
    console.log("Peer for EID 1315:", peer);
    console.log("Expected:", hre.ethers.zeroPadValue(storyOft.address, 32));
    console.log("Match:", peer.toLowerCase() === hre.ethers.zeroPadValue(storyOft.address, 32).toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
