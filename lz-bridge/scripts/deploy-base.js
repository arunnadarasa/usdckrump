const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying LayerZero V2 to Base Sepolia");
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. Deploy EndpointV2
  // EndpointV2 constructor: (uint32 _eid, address _owner)
  console.log("1/6 Deploying EndpointV2...");
  const EndpointV2 = await hre.ethers.getContractFactory("EndpointV2");
  const endpoint = await EndpointV2.deploy(
    40245, // Base Sepolia LayerZero EID (not chain ID 84532!)
    deployer.address // Owner
  );
  await endpoint.waitForDeployment();
  const endpointAddress = await endpoint.getAddress();
  console.log("   ✅ EndpointV2:", endpointAddress);

  // 2. Deploy SendUln302
  // Constructor: (address _endpoint, uint256 _treasuryGasLimit, uint256 _treasuryGasForFeeCap)
  console.log("2/6 Deploying SendUln302...");
  const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
  const sendUln = await SendUln302.deploy(
    endpointAddress,
    50000, // _treasuryGasLimit
    1000000000000000000n // _treasuryGasForFeeCap (1 ETH)
  );
  await sendUln.waitForDeployment();
  const sendUlnAddress = await sendUln.getAddress();
  console.log("   ✅ SendUln302:", sendUlnAddress);

  // 3. Deploy ReceiveUln302
  console.log("3/6 Deploying ReceiveUln302...");
  const ReceiveUln302 = await hre.ethers.getContractFactory("ReceiveUln302");
  const receiveUln = await ReceiveUln302.deploy(endpointAddress);
  await receiveUln.waitForDeployment();
  const receiveUlnAddress = await receiveUln.getAddress();
  console.log("   ✅ ReceiveUln302:", receiveUlnAddress);

  // 4. Deploy Executor (optional - can use executor worker instead)
  console.log("4/6 Deploying Executor...");
  let executorAddress = "0x0000000000000000000000000000000000000000";
  try {
    const Executor = await hre.ethers.getContractFactory("Executor");
    const executor = await Executor.deploy(endpointAddress);
    await executor.waitForDeployment();
    executorAddress = await executor.getAddress();
    console.log("   ✅ Executor:", executorAddress);
  } catch (error) {
    console.log("   ⚠️  Executor deployment skipped (using executor worker instead):", error.message);
  }

  // 5. Enable Story Aeneid (EID 1315) on SendUln302
  console.log("5/6 Configuring SendUln302 for Story Aeneid (EID 1315)...");
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  
  const ulnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [storyInfra.receiveUln302]
  };

  const configParam = {
    eid: 1315,
    config: ulnConfig
  };

  const tx1 = await sendUln.setDefaultUlnConfigs([configParam]);
  await tx1.wait();
  console.log("   ✅ SendUln302 configured for Story Aeneid");

  // 6. Set default libraries for Story Aeneid (optional, can also set per-OApp)
  console.log("6/6 Setting default libraries for Story Aeneid...");
  try {
    const tx2 = await endpoint.setDefaultSendLibrary(1315, sendUlnAddress);
    await tx2.wait();
    console.log("   ✅ Default send library set");
    
    const tx3 = await endpoint.setDefaultReceiveLibrary(1315, receiveUlnAddress, 0);
    await tx3.wait();
    console.log("   ✅ Default receive library set");
  } catch (e) {
    console.log("   ⚠️  Could not set default libraries (may need per-OApp config):", e.message);
  }
  console.log();

  // Save deployment
  const deployment = {
    chain: "base-sepolia",
    chainId: 84532,
    endpointV2: endpointAddress,
    sendUln302: sendUlnAddress,
    receiveUln302: receiveUlnAddress,
    executor: executorAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    note: "Our own endpoint for full control"
  };

  fs.mkdirSync("deployments", { recursive: true });
  const filename = `deployments/base-sepolia-own-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  fs.writeFileSync("deployments/base-sepolia-own-latest.json", JSON.stringify(deployment, null, 2));

  console.log("📦 Base Sepolia deployment saved to:", filename);
  console.log("\n✅ Infrastructure deployed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Redeploy USDCKrumpOFT with new endpoint:");
  console.log("      npx hardhat run scripts/redeploy-oft-with-own-endpoint.js --network baseSepolia");
  console.log("\n   2. Configure libraries for USDCKrumpOFT:");
  console.log("      npx hardhat run scripts/configure-own-endpoint-libraries.js --network baseSepolia");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
