const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify USDCKrumpOFT on Story Aeneid (StoryScan/Blockscout).
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid: npx hardhat run scripts/verify-oft-krump-story.js --network storyAeneid");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8")
  );

  const constructorArgs = [
    deployment.endpoint,
    deployment.backend,
    deployment.backend,
  ];

  console.log("🔍 Verifying USDCKrumpOFT on StoryScan (Story Aeneid)...");
  console.log("   Address:", deployment.address);

  try {
    await hre.run("verify:verify", {
      address: deployment.address,
      constructorArguments: constructorArgs,
      network: "storyAeneid",
      contract: "contracts/USDCKrumpOFT.sol:USDCKrumpOFT",
    });
    console.log("✅ USDCKrumpOFT verified!");
    console.log("   https://aeneid.storyscan.io/address/" + deployment.address + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("⚠️  Contract is already verified.");
      console.log("   https://aeneid.storyscan.io/address/" + deployment.address + "#code");
    } else {
      console.error("❌ Verification failed:", err.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
