const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify USDCDanceOFT on Story Aeneid (StoryScan/Blockscout).
 * Blockscout doesn't require an API key.
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ This script is for Story Aeneid (chainId 1315) only.");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/usdc-story-aeneid-latest.json", "utf8")
  );

  // Constructor: (address _endpoint, address _delegate, address _backend)
  // Delegate was deployer (same as backend) at deploy time.
  const constructorArgs = [
    deployment.endpoint,
    deployment.backend, // delegate
    deployment.backend, // backend
  ];

  console.log("🔍 Verifying USDCDanceOFT on StoryScan (Story Aeneid)...");
  console.log("   Address:", deployment.address);
  console.log("   Constructor args:", constructorArgs.join(", "));

  try {
    await hre.run("verify:verify", {
      address: deployment.address,
      constructorArguments: constructorArgs,
      network: "storyAeneid",
    });
    console.log("✅ Contract verified!");
    console.log("   https://aeneid.storyscan.io/address/" + deployment.address + "#code");
  } catch (err) {
    if (
      err.message &&
      (err.message.includes("Already Verified") || err.message.includes("already verified"))
    ) {
      console.log("⚠️  Contract is already verified.");
      console.log("   https://aeneid.storyscan.io/address/" + deployment.address + "#code");
    } else if (err.message && err.message.includes("bytecode doesn't match")) {
      console.error("❌ Verification failed: bytecode mismatch.");
      console.error("   The on-chain contract was likely built with different source or compiler settings.");
      console.log("\n📋 Manual verification on StoryScan:");
      console.log("   1. Open https://aeneid.storyscan.io/address/" + deployment.address + "#code");
      console.log("   2. Click 'Verify and Publish'");
      console.log("   3. Compiler: Solidity 0.8.20, Optimizer enabled, 200 runs, Via-IR: Yes");
      console.log("   4. Constructor args (ABI-encoded):");
      const encoded = new hre.ethers.AbiCoder().encode(
        ["address", "address", "address"],
        constructorArgs
      );
      console.log("      " + encoded.slice(2));
      console.log("   5. Paste flattened source or use Standard-Json-Input from Hardhat build.");
      console.log("\n💡 To generate flattened source:");
      console.log("   npx hardhat flatten contracts/USDCDanceOFT.sol > usdcdanceoft-story-flattened.sol");
      console.log("\n💡 To generate Standard-Json-Input:");
      console.log("   Check artifacts/build-info/ for the latest build JSON");
      process.exit(1);
    } else {
      console.error("❌ Verification failed:", err.message);
      console.error("   Full error:", err);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
