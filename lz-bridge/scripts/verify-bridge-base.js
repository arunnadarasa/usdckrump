const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify BridgeVault on Base Sepolia (BaseScan).
 * Requires ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env.
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia (chainId 84532)");
    process.exit(1);
  }

  if (!process.env.ETHERSCAN_API_KEY && !process.env.BASESCAN_API_KEY) {
    console.error("❌ Set ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/bridge-base-sepolia-latest.json", "utf8")
  );

  const constructorArgs = [deployment.token, deployment.sourceChainId, deployment.attester];

  console.log("🔍 Verifying BridgeVault on BaseScan (Base Sepolia)...");
  console.log("   Address:", deployment.bridgeVault);
  console.log("   Constructor args:", constructorArgs.join(", "));

  try {
    await hre.run("verify:verify", {
      address: deployment.bridgeVault,
      constructorArguments: constructorArgs,
      network: "baseSepolia",
      contract: "contracts/bridge/BridgeVault.sol:BridgeVault",
    });
    console.log("✅ BridgeVault verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.bridgeVault + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("⚠️  Contract is already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.bridgeVault + "#code");
    } else if (err.message && err.message.includes("Etherscan API V2")) {
      console.error("❌ BaseScan requires Etherscan API V2. Use manual verification:");
      console.log("   1. Open https://sepolia.basescan.org/verifyContract?a=" + deployment.bridgeVault);
      console.log("   2. Compiler: Solidity 0.8.20, Optimizer enabled, 200 runs, Via-IR: Yes");
      console.log("   3. Contract: contracts/bridge/BridgeVault.sol:BridgeVault");
      const encoded = new hre.ethers.AbiCoder().encode(
        ["address", "uint64", "address"],
        [deployment.token, deployment.sourceChainId, deployment.attester]
      );
      console.log("   4. Constructor args (ABI-encoded):", encoded.slice(2));
      console.log("   Or get a V2 API key: https://docs.etherscan.io/v2-migration");
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
