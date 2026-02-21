/**
 * Test reverse bridge: lockBack USDC.k on Story Aeneid → receive USDC on Base Sepolia.
 * 
 * Usage:
 *   npx hardhat run scripts/test-usdck-lockback.js --network storyAeneid
 *   # Relayer will automatically call release on Base Sepolia (~15s)
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const bridgeDeploy = JSON.parse(
    fs.readFileSync("deployments/bridge-story-aeneid-latest.json", "utf8")
  );
  const [deployer] = await hre.ethers.getSigners();

  const amount = hre.ethers.parseUnits(process.env.LOCKBACK_AMOUNT || "0.1", 6);
  const recipient = process.env.LOCKBACK_RECIPIENT || deployer.address;

  const bridgeUsdc = await hre.ethers.getContractAt("BridgeUSDC", bridgeDeploy.bridgeUsdc);
  const receiver = await hre.ethers.getContractAt("BridgeReceiver", bridgeDeploy.bridgeReceiver);

  const balance = await bridgeUsdc.balanceOf(deployer.address);
  if (balance < amount) {
    console.error("❌ Insufficient USDC.k. Balance:", hre.ethers.formatUnits(balance, 6));
    process.exit(1);
  }

  const allowance = await bridgeUsdc.allowance(deployer.address, bridgeDeploy.bridgeReceiver);
  if (allowance < amount) {
    console.log("   Approving BridgeReceiver to spend USDC.k...");
    const approveTx = await bridgeUsdc.approve(bridgeDeploy.bridgeReceiver, amount);
    await approveTx.wait();
  }

  console.log("🔙 Locking back", hre.ethers.formatUnits(amount, 6), "USDC.k for recipient", recipient, "on Base Sepolia");
  const tx = await receiver.lockBack(amount, recipient);
  const receipt = await tx.wait();
  
  const ev = receipt.logs.find((l) => {
    try {
      const parsed = receiver.interface.parseLog({ topics: l.topics, data: l.data });
      return parsed && parsed.name === "LockRequestBack";
    } catch {
      return false;
    }
  });
  const nonce = ev ? receiver.interface.parseLog({ topics: ev.topics, data: ev.data }).args.nonce : "?";
  
  console.log("   Tx:", tx.hash, "| Nonce:", nonce.toString());
  console.log("\n✅ LockBack successful! Relayer will release USDC on Base Sepolia (~15s)");
  console.log("   Check Base Sepolia USDC balance for:", recipient);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
