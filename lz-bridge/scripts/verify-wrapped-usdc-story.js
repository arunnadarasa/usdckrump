const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify WrappedUSDC on Story Aeneid (StoryScan).
 * StoryScan uses Blockscout which doesn't require API key.
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid: npm run verify:wrapped-usdc-story -- --network storyAeneid");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/wrapped-usdc-storyAeneid-latest.json", "utf8")
  );

  const constructorArgs = [
    deployment.initialSupply,  // Initial supply (0 = no initial mint)
  ];

  console.log("🔍 Verifying WrappedUSDC on StoryScan (Story Aeneid)...");
  console.log("   Address:", deployment.wrappedUSDC);
  console.log("   Constructor Args:");
  console.log("     Initial Supply:", constructorArgs[0], "(" + hre.ethers.formatUnits(constructorArgs[0], 6) + " USDC)");

  try {
    await hre.run("verify:verify", {
      address: deployment.wrappedUSDC,
      constructorArguments: constructorArgs,
      network: "storyAeneid",
      contract: "contracts/WrappedUSDC.sol:WrappedUSDC",
    });
    console.log("\n✅ WrappedUSDC verified!");
    console.log("   https://aeneid.storyscan.io/address/" + deployment.wrappedUSDC + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("\n⚠️  Contract is already verified.");
      console.log("   https://aeneid.storyscan.io/address/" + deployment.wrappedUSDC + "#code");
    } else {
      console.error("\n❌ Verification failed:", err.message);
      console.log("\n💡 If verification fails, try manual verification:");
      console.log("   1. Go to: https://aeneid.storyscan.io/address/" + deployment.wrappedUSDC + "#code");
      console.log("   2. Click 'Verify and Publish'");
      console.log("   3. Use constructor arguments:", JSON.stringify(constructorArgs));
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
