/**
 * Mint USDCKrumpOFT (USDC.k) for testing
 * Owner-only function
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();
  
  const chainName = network.chainId === 84532n ? "base-sepolia" : "story-aeneid";
  const deployment = JSON.parse(
    fs.readFileSync(`deployments/usdckrump-${chainName}-latest.json`, "utf8")
  );

  console.log(`💰 Minting USDCKrumpOFT (USDC.k) on ${chainName}`);
  console.log("   Owner:", deployer.address);
  console.log("   OFT:", deployment.address);

  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", deployment.address);
  const owner = await oft.owner();
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not owner!");
    process.exit(1);
  }

  const amount = hre.ethers.parseUnits("10", 6); // 10 USDC.k
  console.log(`\n   Minting ${hre.ethers.formatUnits(amount, 6)} USDC.k...`);

  const tx = await oft.mint(deployer.address, amount);
  await tx.wait();
  
  const balance = await oft.balanceOf(deployer.address);
  console.log(`✅ Minted! Balance: ${hre.ethers.formatUnits(balance, 6)} USDC.k`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
