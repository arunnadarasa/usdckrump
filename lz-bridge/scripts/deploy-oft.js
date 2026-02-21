const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  console.log(`🚀 Deploying USDC Dance OFT on chain ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);
  
  // Get current nonce - check both latest and pending
  const latestNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
  const pendingNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  
  console.log(`Latest nonce: ${latestNonce}`);
  console.log(`Pending nonce: ${pendingNonce}`);
  
  // Load LayerZero endpoint for this chain
  const chainName = network.chainId === 84532n ? "base-sepolia" : "story-aeneid";
  const lzDeployment = JSON.parse(
    fs.readFileSync(`deployments/${chainName}-latest.json`, 'utf8')
  );
  
  console.log(`Using LayerZero endpoint: ${lzDeployment.endpointV2}`);
  
  // Use correct nonce - higher gas will replace pending transactions
  let nonce = pendingNonce > latestNonce ? pendingNonce : latestNonce;
  if (pendingNonce > latestNonce) {
    console.log(`   ⚠️  Found ${pendingNonce - latestNonce} pending transaction(s)`);
    console.log(`   Using nonce ${nonce} (higher gas will replace pending tx)`);
  } else {
    console.log(`   Using nonce: ${nonce}`);
  }
  
  const USDCDanceOFT = await hre.ethers.getContractFactory("USDCDanceOFT");
  
  // Deploy contract
  console.log("\nDeploying contract...");
  
  const deployOptions = {
    nonce: nonce  // Use latest nonce - higher gas price will replace pending tx
  };
  
  if (network.chainId === 84532n) {
    // Base Sepolia requires minimum 687,140 gas for EIP-4844 blob transactions
    const minRequiredGas = 687140n;
    
    // Re-check balance right before deployment (it may have changed)
    const currentBalance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`   Current balance: ${hre.ethers.formatEther(currentBalance)} ETH`);
    
    // Use competitive gas price for instant confirmation (1.5 gwei gets included in next block)
    // Base Sepolia testnet is usually very cheap, so 1.5 gwei is fast but still affordable
    deployOptions.gasPrice = hre.ethers.parseUnits("1.5", "gwei");
    
    // Use high gas limit - OFT + via-IR is heavy; 5M (block limit 14M on Base Sepolia)
    deployOptions.gasLimit = 5000000n;
    
    console.log(`   Using gas price: ${hre.ethers.formatUnits(deployOptions.gasPrice, "gwei")} gwei`);
    console.log(`   Using gas limit: ${deployOptions.gasLimit.toLocaleString()}`);
    
    const estimatedCost = deployOptions.gasPrice * deployOptions.gasLimit;
    console.log(`   Estimated cost: ${hre.ethers.formatEther(estimatedCost)} ETH`);
    
    if (estimatedCost > currentBalance) {
      throw new Error(`Insufficient balance: need ${hre.ethers.formatEther(estimatedCost)} ETH but have ${hre.ethers.formatEther(currentBalance)} ETH`);
    }
  }
  
  const deploymentTx = await USDCDanceOFT.deploy(
    lzDeployment.endpointV2,
    deployer.address,       // delegate (can configure OApp settings)
    deployer.address,       // backend address
    deployOptions
  );
  
  console.log(`Transaction hash: ${deploymentTx.deploymentTransaction()?.hash}`);
  console.log("Waiting for deployment...");
  
  await deploymentTx.waitForDeployment();
  const oftAddress = await deploymentTx.getAddress();
  
  console.log("✅ USDCDanceOFT deployed to:", oftAddress);
  console.log("   Token Name: USDC Dance");
  console.log("   Token Symbol: USDC.d");
  console.log("   Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)");
  console.log("   Website: https://asura.lovable.app/");
  
  // Save deployment
  const deployment = {
    chain: chainName,
    chainId: Number(network.chainId),
    address: oftAddress,
    endpoint: lzDeployment.endpointV2,
    backend: deployer.address,
    tokenName: "USDC Dance",
    tokenSymbol: "USDC.d",
    decimals: 6,
    deployedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    `deployments/usdc-${chainName}-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );
  fs.writeFileSync(
    `deployments/usdc-${chainName}-latest.json`,
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("📦 Deployment saved\n");
  
  // Instructions for linking
  if (network.chainId === 84532n) {
    console.log("📝 NEXT: Deploy on Story Aeneid, then run link-oft.js");
  } else if (network.chainId === 1315n) {
    console.log("📝 NEXT: Run link-oft.js to pair Base and Story OFTs");
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
