const hre = require("hardhat");
const fs = require("fs");

/**
 * Mint test tokens for testing purposes
 * Requires the contract owner to execute
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("💰 Minting Test Tokens\n");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer/Owner: ${deployer.address}\n`);

  // Load deployment
  const chainName = network.chainId === 84532n ? "base-sepolia" : "story-aeneid";
  const deployment = JSON.parse(
    fs.readFileSync(`deployments/usdc-${chainName}-latest.json`, 'utf8')
  );

  console.log(`Contract: ${deployment.address}\n`);

  const OFT = await hre.ethers.getContractAt("USDCDanceOFT", deployment.address);

  // Check if deployer is owner
  const owner = await OFT.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the contract owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Deployer: ${deployer.address}\n`);
    process.exit(1);
  }

  console.log("✅ Deployer is the contract owner\n");

  // Mint tokens
  const amount = hre.ethers.parseUnits("100", 6); // 100 USDC.d
  console.log(`Minting ${hre.ethers.formatUnits(amount, 6)} USDC.d to ${deployer.address}...\n`);

  try {
    const tx = await OFT.mint(deployer.address, amount);
    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("   Waiting for confirmation...\n");
    
    const receipt = await tx.wait();
    console.log("✅ Tokens minted successfully!");
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
    
    const balance = await OFT.balanceOf(deployer.address);
    console.log(`💰 New Balance: ${hre.ethers.formatUnits(balance, 6)} USDC.d\n`);
    
    console.log("=".repeat(60));
    console.log("\n✅ Ready for testing!");
    console.log("   You can now run cross-chain transfer tests.\n");
  } catch (error) {
    console.error("❌ Minting failed:", error.message);
    
    if (error.message.includes("OwnableUnauthorizedAccount")) {
      console.log("\n💡 The deployer address is not the contract owner.");
      console.log("   Check the deployment file for the correct owner address.\n");
    } else if (error.message.includes("Cannot mint to zero address")) {
      console.log("\n💡 Invalid recipient address.\n");
    } else {
      console.log("\n💡 Check the error message above for details.\n");
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
