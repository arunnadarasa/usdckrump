const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify EVVMPaymentAdapter on Story Aeneid (StoryScan/Blockscout).
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ This script is for Story Aeneid (chainId 1315) only.");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/storyAeneid-evvm-adapter-latest.json", "utf8")
  );

  const args = deployment.constructorArgs;
  const constructorArgs = [
    args.usdcDance,
    args.evvmCore,
    args.evvmId,
    args.owner,
  ];

  console.log("🔍 Verifying EVVMPaymentAdapter on StoryScan (Story Aeneid)...");
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
      const encoded = new hre.ethers.AbiCoder().encode(
        ["address", "address", "uint256", "address"],
        constructorArgs
      );
      console.log("\n📋 Manual verification: Constructor args (ABI-encoded):");
      console.log("   " + encoded.slice(2));
      process.exit(1);
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
