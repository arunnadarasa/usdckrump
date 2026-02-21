const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying LayerZero V2 to Story Aeneid");
  console.log("Deployer:", deployer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  // Load Base Sepolia deployment (we need their endpoint address)
  const baseDeployment = JSON.parse(
    fs.readFileSync('deployments/base-sepolia-latest.json', 'utf8')
  );
  console.log("📎 Base Sepolia Endpoint:", baseDeployment.endpointV2);

  // Get current nonce to avoid "already known" errors
  let nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log(`Starting nonce: ${nonce}\n`);

  // 1. Deploy EndpointV2 on Story Aeneid
  // EndpointV2 constructor: (uint32 _eid, address _owner)
  console.log("1/5 Deploying EndpointV2...");
  const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
  const endpoint = await EndpointV2.deploy(
    1315, // Endpoint ID (EID) for Story Aeneid
    deployer.address, // Owner
    { nonce: nonce++ }
  );
  await endpoint.waitForDeployment();
  const endpointAddress = await endpoint.getAddress();
  console.log("   ✅ EndpointV2:", endpointAddress);

  // 2. Deploy SendUln302
  // Constructor: (address _endpoint, uint256 _treasuryGasLimit, uint256 _treasuryGasForFeeCap)
  console.log("2/5 Deploying SendUln302...");
  const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
  const sendUln = await SendUln302.deploy(
    endpointAddress,
    50000, // _treasuryGasLimit
    1000000000000000000n, // _treasuryGasForFeeCap (1 IP in wei)
    { nonce: nonce++ }
  );
  await sendUln.waitForDeployment();
  const sendUlnAddress = await sendUln.getAddress();
  console.log("   ✅ SendUln302:", sendUlnAddress);

  // 3. Deploy ReceiveUln302
  console.log("3/5 Deploying ReceiveUln302...");
  const ReceiveUln302 = await hre.ethers.getContractFactory("ReceiveUln302");
  const receiveUln = await ReceiveUln302.deploy(endpointAddress, { nonce: nonce++ });
  await receiveUln.waitForDeployment();
  const receiveUlnAddress = await receiveUln.getAddress();
  console.log("   ✅ ReceiveUln302:", receiveUlnAddress);

  // 4. Deploy Executor (optional - can be deployed separately if needed)
  console.log("4/5 Deploying Executor...");
  let executorAddress = "0x0000000000000000000000000000000000000000"; // Placeholder
  try {
    const Executor = await hre.ethers.getContractFactory("Executor");
    const executor = await Executor.deploy(endpointAddress, { nonce: nonce++ });
    await executor.waitForDeployment();
    executorAddress = await executor.getAddress();
    console.log("   ✅ Executor:", executorAddress);
  } catch (error) {
    console.log("   ⚠️  Executor deployment skipped (not critical for basic functionality):", error.message);
    console.log("   Note: Executor can be deployed separately if needed");
  }

  // 5. Register libraries (required before they can be used)
  console.log("5/5 Registering libraries...");
  const tx1 = await endpoint.registerLibrary(sendUlnAddress);
  await tx1.wait();
  const tx2 = await endpoint.registerLibrary(receiveUlnAddress);
  await tx2.wait();
  console.log("   ✅ Libraries registered");
  console.log("   ⚠️  Note: Default libraries not configured yet.");
  console.log("   To enable cross-chain messaging, you need to:");
  console.log("   1. Configure ULN configs on SendUln302/ReceiveUln302 for Base Sepolia EID (84532)");
  console.log("   2. Set default libraries using setDefaultSendLibrary/setDefaultReceiveLibrary");
  console.log("   Or configure libraries per-OApp using setSendLibrary/setReceiveLibrary\n");

  // Register executor (if deployed)
  if (executorAddress !== "0x0000000000000000000000000000000000000000") {
    const tx5 = await endpoint.setExecutor(executorAddress, true);
    await tx5.wait();
    console.log("   ✅ Executor registered\n");
  } else {
    console.log("   ⚠️  Executor not registered (not deployed)\n");
  }

  // Save deployment
  const deployment = {
    chain: "story-aeneid",
    chainId: 1315,
    endpointV2: endpointAddress,
    sendUln302: sendUlnAddress,
    receiveUln302: receiveUlnAddress,
    executor: executorAddress,
    baseEndpoint: baseDeployment.endpointV2,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  fs.writeFileSync(
    `deployments/story-aeneid-${Date.now()}.json`,
    JSON.stringify(deployment, null, 2)
  );
  fs.writeFileSync(
    "deployments/story-aeneid-latest.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log("📦 Story Aeneid deployment saved");
  console.log("\n🎉 LayerZero V2 deployed on both chains!");
  console.log("\n📝 Next: Deploy USDC OFT on Story Aeneid");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
