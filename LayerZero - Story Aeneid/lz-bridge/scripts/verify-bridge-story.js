const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify BridgeUSDC and BridgeReceiver on Story Aeneid (StoryScan).
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid (chainId 1315)");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/bridge-story-aeneid-latest.json", "utf8")
  );

  // 1. BridgeUSDC (no constructor args)
  console.log("🔍 Verifying BridgeUSDC on StoryScan...");
  console.log("   Address:", deployment.bridgeUsdc);
  try {
    await hre.run("verify:verify", {
      address: deployment.bridgeUsdc,
      constructorArguments: [],
      network: "storyAeneid",
      contract: "contracts/bridge/BridgeUSDC.sol:BridgeUSDC",
    });
    console.log("✅ BridgeUSDC verified!");
    console.log("   https://aeneid.storyscan.io/address/" + deployment.bridgeUsdc + "#code\n");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("⚠️  BridgeUSDC is already verified.\n");
    } else {
      console.error("❌ BridgeUSDC verification failed:", err.message);
      process.exit(1);
    }
  }

  // 2. BridgeReceiver (bridgeUsdc, attester)
  const receiverArgs = [deployment.bridgeUsdc, deployment.attester];
  console.log("🔍 Verifying BridgeReceiver on StoryScan...");
  console.log("   Address:", deployment.bridgeReceiver);
  console.log("   Constructor args:", receiverArgs.join(", "));
  try {
    await hre.run("verify:verify", {
      address: deployment.bridgeReceiver,
      constructorArguments: receiverArgs,
      network: "storyAeneid",
      contract: "contracts/bridge/BridgeReceiver.sol:BridgeReceiver",
    });
    console.log("✅ BridgeReceiver verified!");
    console.log("   https://aeneid.storyscan.io/address/" + deployment.bridgeReceiver + "#code");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("⚠️  BridgeReceiver is already verified.");
      console.log("   https://aeneid.storyscan.io/address/" + deployment.bridgeReceiver + "#code");
    } else {
      console.error("❌ BridgeReceiver verification failed:", err.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
