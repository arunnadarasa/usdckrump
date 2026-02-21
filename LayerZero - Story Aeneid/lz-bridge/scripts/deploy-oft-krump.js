const hre = require("hardhat");
const fs = require("fs");

/**
 * Deploy USDCKrumpOFT (USDC.k) on Base Sepolia or Story Aeneid for future LayerZero support.
 * Run: npx hardhat run scripts/deploy-oft-krump.js --network baseSepolia
 *      npx hardhat run scripts/deploy-oft-krump.js --network storyAeneid
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`\n🚀 Deploying USDC Krump OFT (USDC.k) on chain ${network.chainId}`);
  console.log("   Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(balance), "ETH\n");

  const chainName = network.chainId === 84532n ? "base-sepolia" : "story-aeneid";
  const lzDeployment = JSON.parse(
    fs.readFileSync(`deployments/${chainName}-latest.json`, "utf8")
  );

  console.log("   LayerZero endpoint:", lzDeployment.endpointV2);

  const deployOptions = {};
  if (network.chainId === 84532n) {
    const feeData = await hre.ethers.provider.getFeeData();
    if (feeData.maxFeePerGas) {
      deployOptions.maxFeePerGas = feeData.maxFeePerGas;
      deployOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas / 2n;
    }
    deployOptions.gasLimit = 5000000n;
  }
  if (network.chainId === 1315n) {
    deployOptions.gasPrice = 10_000_000_000n; // 10 gwei Story Aeneid
  }

  const USDCKrumpOFT = await hre.ethers.getContractFactory("USDCKrumpOFT");
  const oft = await USDCKrumpOFT.deploy(
    lzDeployment.endpointV2,
    deployer.address,
    deployer.address,
    deployOptions
  );

  await oft.waitForDeployment();
  const address = await oft.getAddress();

  console.log("\n✅ USDCKrumpOFT deployed:", address);
  console.log("   Token: USDC Krump (USDC.k)");
  console.log("   Credits: StreetKode Fam (Asura, Hectik, Kronos, Jo)");
  console.log("   Website: https://asura.lovable.app/\n");

  const deployment = {
    chain: chainName,
    chainId: Number(network.chainId),
    address,
    endpoint: lzDeployment.endpointV2,
    backend: deployer.address,
    tokenName: "USDC Krump",
    tokenSymbol: "USDC.k",
    decimals: 6,
    deployedAt: new Date().toISOString(),
  };

  const dir = "deployments";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/usdckrump-${chainName}-latest.json`, JSON.stringify(deployment, null, 2));
  fs.writeFileSync(`${dir}/usdckrump-${chainName}-${Date.now()}.json`, JSON.stringify(deployment, null, 2));

  console.log("   Saved: deployments/usdckrump-" + chainName + "-latest.json");
  if (network.chainId === 84532n) {
    console.log("\n📝 Next: Deploy USDCKrumpOFT on Story Aeneid, then run link-oft for USDC.k (or add link-oft-krump.js).");
  } else {
    console.log("\n📝 Next: Run link-oft-krump.js to pair Base and Story USDC.k OFTs.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
