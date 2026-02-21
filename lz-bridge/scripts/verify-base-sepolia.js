const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify USDCDanceOFT on Base Sepolia (BaseScan).
 * Requires ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env (Etherscan API V2 key).
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ This script is for Base Sepolia (chainId 84532) only.");
    process.exit(1);
  }

  if (!process.env.ETHERSCAN_API_KEY && !process.env.BASESCAN_API_KEY) {
    console.error("❌ Set ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env (Etherscan API V2 key).");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/usdc-base-sepolia-latest.json", "utf8")
  );

  // Constructor: (address _endpoint, address _delegate, address _backend)
  // Delegate was deployer (same as backend) at deploy time.
  const constructorArgs = [
    deployment.endpoint,
    deployment.backend, // delegate
    deployment.backend, // backend
  ];

  console.log("🔍 Verifying USDCDanceOFT on BaseScan (Base Sepolia)...");
  console.log("   Address:", deployment.address);
  console.log("   Constructor args:", constructorArgs.join(", "));

  try {
    await hre.run("verify:verify", {
      address: deployment.address,
      constructorArguments: constructorArgs,
      network: "baseSepolia",
    });
    console.log("✅ Contract verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.address + "#code");
  } catch (err) {
    if (
      err.message &&
      (err.message.includes("Already Verified") || err.message.includes("already verified"))
    ) {
      console.log("⚠️  Contract is already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.address + "#code");
    } else if (err.message && err.message.includes("bytecode doesn't match")) {
      console.error("❌ Verification failed: bytecode mismatch.");
      console.error("   The on-chain contract was likely built with different source or compiler settings.");
      console.log("\n📋 Manual verification on BaseScan:");
      console.log("   1. Open https://sepolia.basescan.org/verifyContract?a=" + deployment.address);
      console.log("   2. Compiler: Solidity 0.8.20, Optimizer enabled, 200 runs, Via-IR: Yes");
      console.log("   3. Constructor args (ABI-encoded):");
      const encoded = new hre.ethers.AbiCoder().encode(
        ["address", "address", "address"],
        constructorArgs
      );
      console.log("      " + encoded.slice(2));
      console.log("   4. Paste flattened source or use Standard-Json-Input from Hardhat build.");
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
