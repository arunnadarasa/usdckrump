const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify USDCKrumpOFT on Base Sepolia (BaseScan).
 * Requires ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env.
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: npx hardhat run scripts/verify-oft-krump-base.js --network baseSepolia");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8")
  );

  const constructorArgs = [
    deployment.endpoint,
    deployment.backend,
    deployment.backend,
  ];

  console.log("🔍 Verifying USDCKrumpOFT on BaseScan (Base Sepolia)...");
  console.log("   Address:", deployment.address);

  try {
    await hre.run("verify:verify", {
      address: deployment.address,
      constructorArguments: constructorArgs,
      network: "baseSepolia",
      contract: "contracts/USDCKrumpOFT.sol:USDCKrumpOFT",
    });
    console.log("✅ USDCKrumpOFT verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.address + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("⚠️  Contract is already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.address + "#code");
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
