const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔗 Linking OAppProxyOFT contracts for cross-chain bridging\n");

  // Load deployments
  const baseDeployment = JSON.parse(
    fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8")
  );

  console.log("Base Sepolia OAppProxyOFT:", baseDeployment.oappProxyOft);
  console.log("Story Aeneid OAppProxyOFT:", storyDeployment.oappProxyOft);

  // Base Sepolia EID: 40245 (EndpointId.BASESEP_V2_TESTNET)
  // Story Aeneid EID: 1315
  const BASE_SEPOLIA_EID = 40245;
  const STORY_AENEID_EID = 1315;

  // Convert addresses to bytes32 for peer setting
  const basePeer = hre.ethers.zeroPadValue(baseDeployment.oappProxyOft, 32);
  const storyPeer = hre.ethers.zeroPadValue(storyDeployment.oappProxyOft, 32);

  console.log("\n📡 Setting peers...");
  console.log("⚠️  Note: This script requires running on both networks separately");
  console.log("   Run once on Base Sepolia, then once on Story Aeneid\n");

  const network = await hre.ethers.provider.getNetwork();
  const [signer] = await hre.ethers.getSigners();
  console.log("Current Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("Signer:", signer.address);

  if (network.chainId === 84532n) {
    // Base Sepolia - set peer to Story Aeneid
    console.log("\nSetting peer on Base Sepolia (pointing to Story Aeneid)...");
    const baseOft = await hre.ethers.getContractAt(
      "OAppProxyOFT",
      baseDeployment.oappProxyOft
    );
    const tx1 = await baseOft.setPeer(STORY_AENEID_EID, storyPeer);
    await tx1.wait();
    console.log("   ✅ Base Sepolia peer set");
    console.log("\n📝 Next: Run this script on Story Aeneid:");
    console.log("   npm run link:proxy-oft -- --network storyAeneid");
  } else if (network.chainId === 1315n) {
    // Story Aeneid - set peer to Base Sepolia
    console.log("\nSetting peer on Story Aeneid (pointing to Base Sepolia)...");
    const storyOft = await hre.ethers.getContractAt(
      "OAppProxyOFT",
      storyDeployment.oappProxyOft
    );
    const tx2 = await storyOft.setPeer(BASE_SEPOLIA_EID, basePeer);
    await tx2.wait();
    console.log("   ✅ Story Aeneid peer set");
    console.log("\n✅ OAppProxyOFT contracts linked successfully!");
    console.log("   Base Sepolia ↔ Story Aeneid");
  } else {
    console.error("❌ Unsupported network. Use Base Sepolia (84532) or Story Aeneid (1315)");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
