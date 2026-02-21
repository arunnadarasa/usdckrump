const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();

  console.log("🔒 Deploying WrappedUSDC");
  console.log("   Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("   Deployer:", deployer.address);

  if (network.chainId !== 1315n) {
    console.log("⚠️  Warning: This is typically deployed on Story Aeneid (1315)");
    console.log("   Continuing anyway...\n");
  }

  // Initial supply (0 = no initial mint)
  const initialSupply = process.env.WRAPPED_USDC_INITIAL_SUPPLY 
    ? hre.ethers.parseUnits(process.env.WRAPPED_USDC_INITIAL_SUPPLY, 6)
    : 0n;

  console.log("   Initial Supply:", hre.ethers.formatUnits(initialSupply, 6), "USDC");

  const WrappedUSDC = await hre.ethers.getContractFactory("WrappedUSDC");
  const wrappedUsdc = await WrappedUSDC.deploy(initialSupply);
  await wrappedUsdc.waitForDeployment();
  const address = await wrappedUsdc.getAddress();

  const deployment = {
    chain: network.name,
    chainId: Number(network.chainId),
    wrappedUSDC: address,
    initialSupply: initialSupply.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const filename = `deployments/wrapped-usdc-${network.name}-latest.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));

  console.log("\n✅ WrappedUSDC deployed:", address);
  console.log("   Saved:", filename);
  console.log("   Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)\n");

  console.log("📝 Next steps:");
  console.log("   1. Set in .env: STORY_AENEID_USDC=" + address);
  console.log("   2. Deploy OAppProxyOFT: npm run deploy:proxy-oft -- --network storyAeneid");
  console.log("   3. Authorize OAppProxyOFT as minter (optional, for minting on receive)");
  
  if (initialSupply === 0n) {
    console.log("\n💡 Tip: To mint initial supply, call:");
    console.log(`   wrappedUSDC.mint(${deployer.address}, amount)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
