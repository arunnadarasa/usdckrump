const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy EVVMPaymentAdapter for BridgeUSDC (custom bridge).
 * Use this adapter for OpenClaw agents until LayerZero supports Story Aeneid.
 * Same EVVM Core and evvmId 1140 as the LayerZero adapter.
 */
async function main() {
  const network = hre.network.name;

  if (network !== "storyAeneid") {
    throw new Error("Bridge EVVM adapter must be deployed on Story Aeneid");
  }

  console.log("\n🚀 Deploying Bridge EVVM Payment Adapter on Story Aeneid...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "IP\n");

  const bridgeDeploy = JSON.parse(
    fs.readFileSync("deployments/bridge-story-aeneid-latest.json", "utf8")
  );
  const bridgeUsdcAddress = bridgeDeploy.bridgeUsdc;
  console.log("✓ BridgeUSDC (USDC.k):", bridgeUsdcAddress);

  const EVVM_CONFIG = {
    core: "0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b",
    staking: "0x8F89cBe21d5d03cF24F0C2b084E377bdbbce72CD",
    estimator: "0x33569b317a2901f11D84D2067E060014f8C6208c",
    nameService: "0x2136Bb44415B6227Ab46f9080739b8A54aE56B6B",
    treasury: "0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc",
    p2pSwap: "0xdb1934b7d039FAb96D0F041053E4056ce4954AD2",
    evvmId: 1140,
  };
  console.log("✓ EVVM Core:", EVVM_CONFIG.core);
  console.log("✓ EVVM ID:", EVVM_CONFIG.evvmId);

  const owner = deployer.address;
  console.log("✓ Owner:", owner);

  const EVVMPaymentAdapter = await hre.ethers.getContractFactory("EVVMPaymentAdapter");
  const adapter = await EVVMPaymentAdapter.deploy(
    bridgeUsdcAddress,
    EVVM_CONFIG.core,
    EVVM_CONFIG.evvmId,
    owner
  );

  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();

  console.log("\n✅ Bridge EVVM Payment Adapter deployed!");
  console.log("   Address:", adapterAddress);
  console.log("   Credits: StreetKode Fam (Asura, Hectik, Kronos, Jo) · EVVM 1140");

  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentDir, "bridge-evvm-adapter-latest.json");
  const deploymentData = {
    network: network,
    chainId: 1315,
    contract: "EVVMPaymentAdapter",
    description: "Adapter for BridgeUSDC (custom bridge). Use for OpenClaw until LayerZero supports Story Aeneid.",
    address: adapterAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    constructorArgs: {
      usdcDance: bridgeUsdcAddress,
      evvmCore: EVVM_CONFIG.core,
      evvmId: EVVM_CONFIG.evvmId,
      owner: owner,
    },
    evvmConfig: EVVM_CONFIG,
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("   Saved to:", deploymentFile);

  console.log("\n📋 Next: Configure OpenClaw agents to use this adapter for BridgeUSDC payments.");
  console.log("   LayerZero adapter (0x26cB...) remains for when LZ supports Story Aeneid.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
