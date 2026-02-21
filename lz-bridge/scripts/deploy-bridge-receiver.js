const hre = require("hardhat");
const fs = require("fs");

const STORY_AENEID_CHAIN_ID = 1315;

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== STORY_AENEID_CHAIN_ID) {
    console.error("❌ Run on Story Aeneid (chainId 1315)");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const attester = process.env.BRIDGE_ATTESTER || deployer.address;
  console.log("🌉 Deploying custom bridge on Story Aeneid");
  console.log("   Deployer:", deployer.address);
  console.log("   Attester:", attester, "\n");

  const BridgeUSDC = await hre.ethers.getContractFactory("BridgeUSDC");
  const bridgeUsdc = await BridgeUSDC.deploy();
  await bridgeUsdc.waitForDeployment();
  const bridgeUsdcAddress = await bridgeUsdc.getAddress();
  console.log("   BridgeUSDC:", bridgeUsdcAddress);

  const BridgeReceiver = await hre.ethers.getContractFactory("BridgeReceiver");
  const receiver = await BridgeReceiver.deploy(bridgeUsdcAddress, attester);
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  console.log("   BridgeReceiver:", receiverAddress);

  const tx = await bridgeUsdc.setMinter(receiverAddress);
  await tx.wait();
  console.log("   BridgeUSDC minter set to BridgeReceiver\n");

  const deployment = {
    chain: "story-aeneid",
    chainId: STORY_AENEID_CHAIN_ID,
    bridgeUsdc: bridgeUsdcAddress,
    bridgeReceiver: receiverAddress,
    attester,
    sourceChainIdForFulfill: 84532,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployments/bridge-story-aeneid-latest.json",
    JSON.stringify(deployment, null, 2)
  );
  console.log("✅ Bridge deployed on Story Aeneid");
  console.log("   Saved: deployments/bridge-story-aeneid-latest.json");
  console.log("   Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)\n");
  console.log("📝 Next: Run relayer to watch LockRequest and call fulfillLock:");
  console.log("   BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
