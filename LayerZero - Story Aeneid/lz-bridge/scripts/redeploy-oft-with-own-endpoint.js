/**
 * Redeploy USDCKrumpOFT with our own EndpointV2
 * ⚠️  WARNING: This creates a NEW token contract - existing balances will be lost!
 * 
 * Only use this if you want to migrate to your own endpoint infrastructure.
 * Otherwise, keep using the existing USDCKrumpOFT with LayerZero's official endpoint.
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("⚠️  REDEPLOYING USDCKrumpOFT WITH OWN ENDPOINT");
  console.log("=".repeat(60));
  console.log("⚠️  WARNING: This creates a NEW token - existing balances will be lost!");
  console.log("=".repeat(60));
  console.log("\nDeployer:", deployer.address);

  // Load our own endpoint deployment
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const oldOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  console.log("\nOld USDCKrumpOFT:", oldOft.address);
  console.log("Old endpoint:", oldOft.endpoint);
  console.log("\nNew endpoint:", ownEndpoint.endpointV2);
  console.log("\n⚠️  Are you sure you want to continue?");
  console.log("   This will create a NEW token contract.");
  console.log("   Existing USDC.k balances will NOT transfer to the new contract.\n");

  // Deploy with new endpoint
  const deployOptions = {};
  const feeData = await hre.ethers.provider.getFeeData();
  if (feeData.maxFeePerGas) {
    deployOptions.maxFeePerGas = feeData.maxFeePerGas;
    deployOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas / 2n;
  }
  deployOptions.gasLimit = 5000000n;

  console.log("Deploying USDCKrumpOFT with new endpoint...");
  const USDCKrumpOFT = await hre.ethers.getContractFactory("USDCKrumpOFT");
  const oft = await USDCKrumpOFT.deploy(
    ownEndpoint.endpointV2, // New endpoint
    deployer.address, // Delegate
    deployer.address, // Backend
    deployOptions
  );

  await oft.waitForDeployment();
  const address = await oft.getAddress();

  console.log("\n✅ New USDCKrumpOFT deployed:", address);

  // Save as new deployment (backup old one)
  const oldFilename = `deployments/usdckrump-base-sepolia-old-${Date.now()}.json`;
  fs.writeFileSync(oldFilename, JSON.stringify(oldOft, null, 2));
  console.log("   Old deployment backed up to:", oldFilename);

  const newDeployment = {
    chain: "base-sepolia",
    chainId: 84532,
    address,
    endpoint: ownEndpoint.endpointV2,
    backend: deployer.address,
    tokenName: "USDC Krump",
    tokenSymbol: "USDC.k",
    decimals: 6,
    deployedAt: new Date().toISOString(),
    note: "Redeployed with own endpoint"
  };

  fs.writeFileSync("deployments/usdckrump-base-sepolia-latest.json", JSON.stringify(newDeployment, null, 2));
  fs.writeFileSync(`deployments/usdckrump-base-sepolia-${Date.now()}.json`, JSON.stringify(newDeployment, null, 2));

  console.log("\n📝 Next steps:");
  console.log("   1. Configure libraries:");
  console.log("      npx hardhat run scripts/configure-own-endpoint-libraries.js --network baseSepolia");
  console.log("\n   2. Link peers:");
  console.log("      npx hardhat run scripts/link-oft-krump.js");
  console.log("\n   3. Test LayerZero send:");
  console.log("      npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia");
}

main().catch((e) => {
  console.error("❌ Redeployment failed:", e.message);
  process.exit(1);
});
