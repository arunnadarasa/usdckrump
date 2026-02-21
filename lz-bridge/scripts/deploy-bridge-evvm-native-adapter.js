const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy EVVMNativeX402Adapter on Story Aeneid.
 * x402-compatible: verifies EIP-3009-style signature on-chain, routes via EVVM native (no EIP-3009 on token).
 * Credits: StreetKode Fam (Asura, Hectik, Kronos, Jo) · EVVM 1140
 */
async function main() {
  const network = hre.network.name;

  if (network !== "storyAeneid") {
    throw new Error("EVVM Native x402 adapter must be deployed on Story Aeneid");
  }

  console.log("\n🚀 Deploying EVVM Native x402 Adapter on Story Aeneid...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "IP\n");

  const bridgeDeploy = JSON.parse(
    fs.readFileSync("deployments/bridge-story-aeneid-latest.json", "utf8")
  );
  const tokenAddress = bridgeDeploy.bridgeUsdc; // USDC Krump (BridgeUSDC)
  console.log("✓ Token (USDC.k):", tokenAddress);

  const EVVM_CONFIG = {
    core: "0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b",
    evvmId: 1140,
  };
  console.log("✓ EVVM Core:", EVVM_CONFIG.core);
  console.log("✓ EVVM ID:", EVVM_CONFIG.evvmId);

  const owner = deployer.address;
  console.log("✓ Owner:", owner);

  const EVVMNativeX402Adapter = await hre.ethers.getContractFactory("EVVMNativeX402Adapter");
  const adapter = await EVVMNativeX402Adapter.deploy(
    tokenAddress,
    EVVM_CONFIG.core,
    EVVM_CONFIG.evvmId,
    owner
  );

  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();

  console.log("\n✅ EVVM Native x402 Adapter deployed!");
  console.log("   Address:", adapterAddress);
  console.log("   Credits: StreetKode Fam (Asura, Hectik, Kronos, Jo) · EVVM 1140");

  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentDir, "bridge-evvm-native-adapter-latest.json");
  const deploymentData = {
    network: network,
    chainId: 1315,
    contract: "EVVMNativeX402Adapter",
    description: "x402 adapter with EVVM native flow (no EIP-3009 on token). HTTP 402 supports EIP-3009-style auth.",
    address: adapterAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    constructorArgs: {
      token: tokenAddress,
      evvmCore: EVVM_CONFIG.core,
      evvmId: EVVM_CONFIG.evvmId,
      owner: owner,
    },
    evvmConfig: EVVM_CONFIG,
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("   Saved to:", deploymentFile);

  console.log("\n📋 Next: Use this adapter for OpenClaw x402 payments; sign with verifyingContract = adapter address.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
