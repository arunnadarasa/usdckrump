const hre = require("hardhat");
const fs = require("fs");

/**
 * Generate manual verification details for OAppProxyOFT on Base Sepolia.
 * BaseScan requires Etherscan API V2 - use this script to get the details for manual verification.
 */
async function main() {
  const deployment = JSON.parse(
    fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
  );

  const constructorArgs = [
    deployment.wrappedToken,  // USDC address
    deployment.endpoint,       // LayerZero endpoint
    deployment.delegate,       // Delegate address
  ];

  console.log("📋 Manual Verification Details for OAppProxyOFT (Base Sepolia)");
  console.log("=".repeat(70));
  console.log("\n📍 Contract Address:");
  console.log("   " + deployment.oappProxyOft);
  console.log("\n🔗 Verification URL:");
  console.log("   https://sepolia.basescan.org/address/" + deployment.oappProxyOft + "#code");
  console.log("\n📝 Constructor Arguments:");
  console.log("   Token:", constructorArgs[0]);
  console.log("   Endpoint:", constructorArgs[1]);
  console.log("   Delegate:", constructorArgs[2]);
  console.log("\n📦 Constructor Arguments (JSON):");
  console.log("   " + JSON.stringify(constructorArgs));
  
  // Encode constructor arguments
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "address", "address"],
    constructorArgs
  );
  console.log("\n🔐 Constructor Arguments (ABI-encoded):");
  console.log("   " + encoded);
  
  console.log("\n⚙️  Compiler Settings:");
  console.log("   Version: 0.8.20");
  console.log("   Optimization: Enabled");
  console.log("   Runs: 1");
  console.log("   viaIR: true");
  
  console.log("\n📖 Steps:");
  console.log("   1. Go to: https://sepolia.basescan.org/address/" + deployment.oappProxyOft + "#code");
  console.log("   2. Click 'Verify and Publish'");
  console.log("   3. Select 'Via Standard JSON Input'");
  console.log("   4. Compiler: 0.8.20");
  console.log("   5. Optimization: Yes, Runs: 1, viaIR: true");
  console.log("   6. Paste Standard JSON Input (from artifacts/build-info/)");
  console.log("   7. Constructor Arguments: " + JSON.stringify(constructorArgs));
  console.log("\n✅ Or use automated verification after updating to Etherscan API V2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
