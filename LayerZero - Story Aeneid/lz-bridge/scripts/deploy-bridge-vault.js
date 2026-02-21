const hre = require("hardhat");
const fs = require("fs");

// Base Sepolia USDC (Circle testnet)
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_SEPOLIA_CHAIN_ID = 84532;

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    console.error("❌ Run on Base Sepolia (chainId 84532)");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const attester = process.env.BRIDGE_ATTESTER || deployer.address;
  console.log("🔒 Deploying BridgeVault on Base Sepolia");
  console.log("   Deployer:", deployer.address);
  console.log("   Attester:", attester);
  console.log("   USDC:", BASE_SEPOLIA_USDC, "\n");

  const BridgeVault = await hre.ethers.getContractFactory("BridgeVault");
  const vault = await BridgeVault.deploy(BASE_SEPOLIA_USDC, BASE_SEPOLIA_CHAIN_ID, attester);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const deployment = {
    chain: "base-sepolia",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    bridgeVault: vaultAddress,
    token: BASE_SEPOLIA_USDC,
    sourceChainId: BASE_SEPOLIA_CHAIN_ID,
    attester,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployments/bridge-base-sepolia-latest.json",
    JSON.stringify(deployment, null, 2)
  );
  console.log("✅ BridgeVault deployed:", vaultAddress);
  console.log("   Saved: deployments/bridge-base-sepolia-latest.json");
  console.log("   Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)\n");
  console.log("📝 Next: Deploy bridge on Story Aeneid: npm run deploy:bridge-receiver");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
