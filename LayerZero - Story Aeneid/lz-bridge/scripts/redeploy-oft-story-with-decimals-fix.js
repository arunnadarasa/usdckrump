/**
 * Redeploy USDCKrumpOFT on Story Aeneid with decimals() fix
 * ⚠️  WARNING: This creates a NEW token contract - existing balances will be lost!
 * 
 * This redeploys the contract with the updated code that includes the decimals() override
 * to fix the SlippageExceeded error caused by incorrect decimal conversion.
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("⚠️  REDEPLOYING USDCKrumpOFT ON STORY AENEID WITH DECIMALS FIX");
  console.log("=".repeat(60));
  console.log("⚠️  WARNING: This creates a NEW token - existing balances will be lost!");
  console.log("=".repeat(60));
  console.log("\nDeployer:", deployer.address);

  // Load Story Aeneid endpoint deployment
  const storyEndpoint = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const oldOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));

  console.log("\nOld USDCKrumpOFT:", oldOft.address);
  console.log("Old endpoint:", oldOft.endpoint);
  console.log("\nNew endpoint:", storyEndpoint.endpointV2);
  console.log("\n⚠️  Are you sure you want to continue?");
  console.log("   This will create a NEW token contract.");
  console.log("   Existing USDC.k balances will NOT transfer to the new contract.");
  console.log("   The new contract includes the decimals() override fix.\n");

  // Deploy with updated contract code (includes decimals() override)
  const deployOptions = {
    gasPrice: 10_000_000_000n, // 10 gwei Story Aeneid
  };

  console.log("Deploying USDCKrumpOFT with decimals fix...");
  const USDCKrumpOFT = await hre.ethers.getContractFactory("USDCKrumpOFT");
  const oft = await USDCKrumpOFT.deploy(
    storyEndpoint.endpointV2, // Story's endpoint
    deployer.address, // Delegate
    deployer.address, // Backend
    deployOptions
  );

  await oft.waitForDeployment();
  const address = await oft.getAddress();

  console.log("\n✅ New USDCKrumpOFT deployed:", address);

  // Verify decimals
  const decimals = await oft.decimals();
  console.log("   Decimals:", decimals.toString(), decimals === 6n ? "✅" : "❌");

  // Save as new deployment (backup old one)
  const oldFilename = `deployments/usdckrump-story-aeneid-old-${Date.now()}.json`;
  fs.writeFileSync(oldFilename, JSON.stringify(oldOft, null, 2));
  console.log("   Old deployment backed up to:", oldFilename);

  const newDeployment = {
    chain: "story-aeneid",
    chainId: 1315,
    address,
    endpoint: storyEndpoint.endpointV2,
    backend: deployer.address,
    tokenName: "USDC Krump",
    tokenSymbol: "USDC.k",
    decimals: 6,
    deployedAt: new Date().toISOString(),
    note: "Redeployed with decimals() override fix"
  };

  fs.writeFileSync("deployments/usdckrump-story-aeneid-latest.json", JSON.stringify(newDeployment, null, 2));
  fs.writeFileSync(`deployments/usdckrump-story-aeneid-${Date.now()}.json`, JSON.stringify(newDeployment, null, 2));

  console.log("\n📝 Next steps:");
  console.log("   1. Configure libraries on Story Aeneid:");
  console.log("      npx hardhat run scripts/configure-story-for-base.js --network storyAeneid");
  console.log("\n   2. Link peers:");
  console.log("      npx hardhat run scripts/link-oft-krump.js");
  console.log("\n   3. Mint tokens:");
  console.log("      npx hardhat run scripts/mint-usdck.js --network storyAeneid");
  console.log("\n   4. Test LayerZero send from Story to Base:");
  console.log("      npx hardhat run scripts/test-lz-oft-send.js --network storyAeneid");
}

main().catch((e) => {
  console.error("❌ Redeployment failed:", e.message);
  process.exit(1);
});
