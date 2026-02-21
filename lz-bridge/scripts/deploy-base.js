const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying LayerZero V2 to Base Sepolia");
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. Deploy EndpointV2
  console.log("1/5 Deploying EndpointV2...");
  const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
  const endpoint = await EndpointV2.deploy();
  await endpoint.waitForDeployment();
  const endpointAddress = await endpoint.getAddress();
  console.log("   ✅ EndpointV2:", endpointAddress);

  // 2. Deploy SendUln302
  console.log("2/5 Deploying SendUln302...");
  const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
  const sendUln = await SendUln302.deploy(endpointAddress);
  await sendUln.waitForDeployment();
  const sendUlnAddress = await sendUln.getAddress();
  console.log("   ✅ SendUln302:", sendUlnAddress);

  // 3. Deploy ReceiveUln302
  console.log("3/5 Deploying ReceiveUln302...");
  const ReceiveUln302 = await hre.ethers.getContractFactory("ReceiveUln302");
  const receiveUln = await ReceiveUln302.deploy(endpointAddress);
  await receiveUln.waitForDeployment();
  const receiveUlnAddress = await receiveUln.getAddress();
  console.log("   ✅ ReceiveUln302:", receiveUlnAddress);

  // 4. Deploy Executor
  console.log("4/5 Deploying Executor...");
  const Executor = await hre.ethers.getContractFactory("Executor");
  const executor = await Executor.deploy(endpointAddress);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  console.log("   ✅ Executor:", executorAddress);

  // 5. Configure Endpoint for Story Aeneid (chain ID 1315)
  console.log("5/5 Configuring Endpoint for Story Aeneid...");
  const tx = await endpoint.setMessagingLibrary(
    1315, // Story Aeneid chain ID
    sendUlnAddress,
    receiveUlnAddress,
    true // isGetOption
  );
  await tx.wait();
  console.log("   ✅ Endpoint configured\n");

  // Save deployment
  const deployment = {
    chain: "base-sepolia",
    chainId: 84532,
    endpointV2: endpointAddress,
    sendUln302: sendUlnAddress,
    receiveUln302: receiveUlnAddress,
    executor: executorAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  fs.mkdirSync("deployments", { recursive: true });
  const filename = `deployments/base-sepolia-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  fs.writeFileSync("deployments/base-sepolia-latest.json", JSON.stringify(deployment, null, 2));

  console.log("📦 Base Sepolia deployment saved to:", filename);
  console.log("\n🎉 Next step: Deploy to Story Aeneid");
  console.log("   npx hardhat run scripts/deploy-story.js --network storyAeneid");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
