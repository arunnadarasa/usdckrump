/**
 * Test the custom bridge: lock USDC on Base Sepolia and optionally trigger relayer.
 * Run on Base Sepolia. Ensure you have USDC (e.g. faucet) and have approved BridgeVault.
 *
 * Usage:
 *   npx hardhat run scripts/test-bridge-lock.js --network baseSepolia
 *   # Then run relayer (in another terminal): BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge
 *
 * Env: LOCK_AMOUNT (default "1"), LOCK_RECIPIENT (default deployer address on Story Aeneid).
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia (chainId 84532)");
    process.exit(1);
  }

  const baseDeploy = JSON.parse(fs.readFileSync("deployments/bridge-base-sepolia-latest.json", "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  const amount = hre.ethers.parseUnits(process.env.LOCK_AMOUNT || "1", 6);
  const recipient = process.env.LOCK_RECIPIENT || deployer.address;

  const vault = await hre.ethers.getContractAt("BridgeVault", baseDeploy.bridgeVault);
  const usdc = await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    baseDeploy.token
  );

  const balance = await usdc.balanceOf(deployer.address);
  if (balance < amount) {
    console.error("❌ Insufficient USDC. Balance:", hre.ethers.formatUnits(balance, 6));
    process.exit(1);
  }

  const allowance = await usdc.allowance(deployer.address, baseDeploy.bridgeVault);
  if (allowance < amount) {
    console.log("   Approving BridgeVault to spend USDC...");
    const approveTx = await usdc.approve(baseDeploy.bridgeVault, amount);
    await approveTx.wait();
  }

  console.log("   Locking", hre.ethers.formatUnits(amount, 6), "USDC for recipient", recipient);
  const tx = await vault.lock(amount, recipient);
  const receipt = await tx.wait();
  const ev = receipt.logs.find((l) => {
    try {
      const parsed = vault.interface.parseLog({ topics: l.topics, data: l.data });
      return parsed && parsed.name === "LockRequest";
    } catch {
      return false;
    }
  });
  const nonce = ev ? vault.interface.parseLog({ topics: ev.topics, data: ev.data }).args.nonce : "?";
  console.log("   Tx:", tx.hash, "| Nonce:", nonce.toString());
  console.log("\n📝 Run relayer to fulfill on Story Aeneid: BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
