const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify OAppProxyOFT on Base Sepolia (BaseScan).
 * Requires ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env.
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: npm run verify:proxy-oft-base -- --network baseSepolia");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
  );

  const constructorArgs = [
    deployment.wrappedToken,  // USDC address
    deployment.endpoint,       // LayerZero endpoint
    deployment.delegate,       // Delegate address
  ];

  console.log("🔍 Verifying OAppProxyOFT on BaseScan (Base Sepolia)...");
  console.log("   Address:", deployment.oappProxyOft);
  console.log("   Constructor Args:");
  console.log("     Token:", constructorArgs[0]);
  console.log("     Endpoint:", constructorArgs[1]);
  console.log("     Delegate:", constructorArgs[2]);

  try {
    await hre.run("verify:verify", {
      address: deployment.oappProxyOft,
      constructorArguments: constructorArgs,
      network: "baseSepolia",
      contract: "contracts/OAppProxyOFT.sol:OAppProxyOFT",
    });
    console.log("\n✅ OAppProxyOFT verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.oappProxyOft + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("\n⚠️  Contract is already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.oappProxyOft + "#code");
    } else {
      console.error("\n❌ Verification failed:", err.message);
      console.log("\n💡 If verification fails, try manual verification:");
      console.log("   1. Go to: https://sepolia.basescan.org/address/" + deployment.oappProxyOft + "#code");
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
