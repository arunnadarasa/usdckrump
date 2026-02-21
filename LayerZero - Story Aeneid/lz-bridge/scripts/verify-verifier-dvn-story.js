/**
 * Verify VerifierDVN on Story Aeneid (StoryScan).
 * Run: npx hardhat run scripts/verify-verifier-dvn-story.js --network storyAeneid
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid: npx hardhat run scripts/verify-verifier-dvn-story.js --network storyAeneid");
    process.exit(1);
  }

  const story = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const address = story.verifierDVN || "0x90Ac1dd333DC509d87059eF4B1cE36eA30e47975";
  const receiveUln302 = story.receiveUln302;

  if (!receiveUln302) {
    console.error("❌ story-aeneid-latest.json missing receiveUln302");
    process.exit(1);
  }

  const constructorArgs = [receiveUln302];

  console.log("🔍 Verifying VerifierDVN on StoryScan (Story Aeneid)...");
  console.log("   Address:", address);
  console.log("   Constructor arg (receiveUln):", constructorArgs[0]);

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
      network: "storyAeneid",
      contract: "contracts/VerifierDVN.sol:VerifierDVN",
    });
    console.log("\n✅ VerifierDVN verified!");
    console.log("   https://aeneid.storyscan.io/address/" + address + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("\n⚠️  Contract is already verified.");
      console.log("   https://aeneid.storyscan.io/address/" + address + "#code");
    } else {
      console.error("\n❌ Verification failed:", err.message);
      console.log("\n💡 Manual verification: https://aeneid.storyscan.io/address/" + address + "#code");
      console.log("   Constructor args (ABI-encoded):", constructorArgs);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
