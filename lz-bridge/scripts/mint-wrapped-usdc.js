/**
 * Mint WrappedUSDC (USDC.k) tokens for testing
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("💰 Minting WrappedUSDC (USDC.k) Tokens\n");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer/Owner: ${deployer.address}\n`);

  // Load deployment
  let wrappedUsdcAddress;
  try {
    const deployment = JSON.parse(
      fs.readFileSync(`deployments/wrapped-usdc-${network.name}-latest.json`, 'utf8')
    );
    wrappedUsdcAddress = deployment.wrappedUSDC;
  } catch (e) {
    // Try alternative path
    try {
      const proxyOftDeployment = JSON.parse(
        fs.readFileSync(`deployments/oapp-proxy-oft-${network.name}-latest.json`, 'utf8')
      );
      wrappedUsdcAddress = proxyOftDeployment.wrappedToken;
      console.log("Using WrappedUSDC from OAppProxyOFT deployment");
    } catch (e2) {
      console.error("❌ Could not find WrappedUSDC deployment");
      console.log("   Make sure WrappedUSDC is deployed first");
      process.exit(1);
    }
  }

  console.log(`WrappedUSDC: ${wrappedUsdcAddress}\n`);

  const wrappedUsdc = await hre.ethers.getContractAt("WrappedUSDC", wrappedUsdcAddress);

  // Check if deployer is owner
  const owner = await wrappedUsdc.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the contract owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Deployer: ${deployer.address}\n`);
    process.exit(1);
  }

  console.log("✅ Deployer is the contract owner\n");

  // Check current balance
  const currentBalance = await wrappedUsdc.balanceOf(deployer.address);
  console.log(`Current Balance: ${hre.ethers.formatUnits(currentBalance, 6)} USDC.k\n`);

  // Mint tokens
  const amount = hre.ethers.parseUnits("100", 6); // 100 USDC.k
  console.log(`Minting ${hre.ethers.formatUnits(amount, 6)} USDC.k to ${deployer.address}...\n`);

  try {
    const tx = await wrappedUsdc.mint(deployer.address, amount);
    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Tokens minted successfully!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());

    // Check new balance
    const newBalance = await wrappedUsdc.balanceOf(deployer.address);
    console.log(`\n💰 New Balance: ${hre.ethers.formatUnits(newBalance, 6)} USDC.k`);

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Ready for testing!");
    console.log("   You can now run cross-chain transfer tests.");
  } catch (error) {
    console.error("\n❌ Minting failed:", error.message);
    if (error.data) {
      console.error("   Error data:", error.data);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
