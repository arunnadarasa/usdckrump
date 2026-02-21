const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  
  if (network !== "storyAeneid") {
    throw new Error("EVVM adapter must be deployed on Story Aeneid");
  }
  
  console.log(`\n🚀 Deploying EVVM Payment Adapter on ${network}...\n`);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "IP\n");
  
  // Load USDCDanceOFT deployment
  const oftDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );
  
  const usdcDanceAddress = oftDeployment.address;
  console.log("✓ USDC.d Token:", usdcDanceAddress);
  
  const EVVM_CONFIG = {
    core: "0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b",
    staking: "0x8F89cBe21d5d03cF24F0C2b084E377bdbbce72CD",
    estimator: "0x33569b317a2901f11D84D2067E060014f8C6208c",
    nameService: "0x2136Bb44415B6227Ab46f9080739b8A54aE56B6B",
    treasury: "0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc",
    p2pSwap: "0xdb1934b7d039FAb96D0F041053E4056ce4954AD2",
    evvmId: 1140
  };
  
  console.log("✓ EVVM Core:", EVVM_CONFIG.core);
  console.log("✓ EVVM ID:", EVVM_CONFIG.evvmId);
  
  const owner = deployer.address;
  console.log("✓ Owner:", owner);
  
  const EVVMPaymentAdapter = await hre.ethers.getContractFactory("EVVMPaymentAdapter");
  const adapter = await EVVMPaymentAdapter.deploy(
    usdcDanceAddress,
    EVVM_CONFIG.core,
    EVVM_CONFIG.evvmId,
    owner
  );
  
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log("\n✅ EVVM Payment Adapter deployed!");
  console.log("   Address:", adapterAddress);
  
  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentDir, `${network}-evvm-adapter-latest.json`);
  const deploymentData = {
    network: network,
    chainId: hre.network.config.chainId,
    contract: "EVVMPaymentAdapter",
    address: adapterAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    constructorArgs: {
      usdcDance: usdcDanceAddress,
      evvmCore: EVVM_CONFIG.core,
      evvmId: EVVM_CONFIG.evvmId,
      owner: owner
    },
    evvmConfig: EVVM_CONFIG
  };
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("   Saved to:", deploymentFile);
  
  console.log("\n📋 Next Steps:");
  console.log("   1. Verify adapter can interact with EVVM Core");
  console.log("   2. Test x402 payment flow");
  console.log("   3. Configure OpenClaw agents to use adapter address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
