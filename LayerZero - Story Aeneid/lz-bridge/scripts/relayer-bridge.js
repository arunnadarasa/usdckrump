/**
 * PoC relayer: two-way USDC ↔ USDC.k bridge.
 * - Base → Story: watches LockRequest on Base Sepolia, calls BridgeReceiver.fulfillLock on Story Aeneid.
 * - Story → Base: watches LockRequestBack on Story Aeneid, calls BridgeVault.release on Base Sepolia.
 *
 * Run with the attester key (same address set as attester on both BridgeReceiver and BridgeVault).
 *
 * Usage (from lz-bridge): npm run relayer:bridge
 *   Or: BRIDGE_ATTESTER_KEY=<key> node scripts/relayer-bridge.js
 *   Loads PRIVATE_KEY from .env if present.
 *
 * Requires: deployments/bridge-base-sepolia-latest.json and bridge-story-aeneid-latest.json
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const POLL_INTERVAL_MS = 15000;
const STORY_AENEID_CHAIN_ID = 1315;

async function main() {
  const basePath = "deployments/bridge-base-sepolia-latest.json";
  const storyPath = "deployments/bridge-story-aeneid-latest.json";
  if (!fs.existsSync(basePath) || !fs.existsSync(storyPath)) {
    console.error("❌ Missing deployment files. Deploy vault and receiver first.");
    process.exit(1);
  }

  const baseDeploy = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const storyDeploy = JSON.parse(fs.readFileSync(storyPath, "utf8"));

  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY";
  const storyRpc = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";

  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const storyProvider = new ethers.JsonRpcProvider(storyRpc);

  let attesterKey = process.env.BRIDGE_ATTESTER_KEY || process.env.PRIVATE_KEY;
  if (!attesterKey) {
    console.error("❌ Set BRIDGE_ATTESTER_KEY or PRIVATE_KEY (attester wallet)");
    process.exit(1);
  }
  // Fly.io (and some env) can concatenate multiple vars into one; use only the hex private key.
  const keyMatch = String(attesterKey).match(/^(0x[0-9a-fA-F]{64})/);
  if (keyMatch) attesterKey = keyMatch[1];
  const storyWallet = new ethers.Wallet(attesterKey, storyProvider);
  const baseWallet = new ethers.Wallet(attesterKey, baseProvider);

  console.log("🔁 USDC Krump bridge relayer (two-way)");
  console.log("   Attester:", storyWallet.address);
  console.log("   Vault (Base Sepolia):", baseDeploy.bridgeVault);
  console.log("   Receiver (Story Aeneid):", storyDeploy.bridgeReceiver);
  console.log("   Poll interval:", POLL_INTERVAL_MS / 1000, "s\n");

  const vaultAbi = [
    "event LockRequest(uint64 indexed sourceChainId, address indexed sender, address indexed destinationRecipient, uint256 amount, uint256 nonce)",
    "function release(address recipient, uint256 amount, uint64 sourceChainId, uint256 nonce)",
    "function usedReleaseNonce(uint64,uint256) view returns (bool)",
  ];
  const receiverAbi = [
    "function fulfillLock(uint64 sourceChainId, uint256 nonce, address recipient, uint256 amount)",
    "function usedNonce(uint64,uint256) view returns (bool)",
    "event LockRequestBack(uint64 indexed destinationChainId, address indexed sender, address indexed destinationRecipient, uint256 amount, uint256 nonce)",
  ];

  const vault = new ethers.Contract(baseDeploy.bridgeVault, vaultAbi, baseProvider);
  const vaultSigner = new ethers.Contract(baseDeploy.bridgeVault, vaultAbi, baseWallet);
  const receiver = new ethers.Contract(storyDeploy.bridgeReceiver, receiverAbi, storyWallet);

  let lastBaseBlock = await baseProvider.getBlockNumber();
  let lastStoryBlock = await storyProvider.getBlockNumber();

  async function pollBaseToStory() {
    const toBlock = await baseProvider.getBlockNumber();
    if (toBlock <= lastBaseBlock) {
      setTimeout(pollBaseToStory, POLL_INTERVAL_MS);
      return;
    }
    const events = await vault.queryFilter(vault.filters.LockRequest(), lastBaseBlock + 1, toBlock);
    lastBaseBlock = toBlock;

    for (const ev of events) {
      const { sourceChainId: evChainId, destinationRecipient, amount, nonce } = ev.args;
      const already = await receiver.usedNonce(evChainId, nonce);
      if (already) continue;

      try {
        const tx = await receiver.fulfillLock(evChainId, nonce, destinationRecipient, amount);
        console.log(`   [Base→Story] Fulfilled nonce ${nonce} → ${destinationRecipient} ${ethers.formatUnits(amount, 6)} USDC.k tx=${tx.hash}`);
        await tx.wait();
      } catch (e) {
        console.error("   [Base→Story] Fulfill failed for nonce", nonce, e.message);
      }
    }
    setTimeout(pollBaseToStory, POLL_INTERVAL_MS);
  }

  async function pollStoryToBase() {
    const toBlock = await storyProvider.getBlockNumber();
    if (toBlock <= lastStoryBlock) {
      setTimeout(pollStoryToBase, POLL_INTERVAL_MS);
      return;
    }
    const events = await receiver.queryFilter(
      receiver.filters.LockRequestBack(),
      lastStoryBlock + 1,
      toBlock
    );
    lastStoryBlock = toBlock;

    for (const ev of events) {
      const { destinationRecipient, amount, nonce } = ev.args;
      const sourceChainId = BigInt(STORY_AENEID_CHAIN_ID);
      const already = await vault.usedReleaseNonce(sourceChainId, nonce);
      if (already) continue;

      try {
        const tx = await vaultSigner.release(
          destinationRecipient,
          amount,
          sourceChainId,
          nonce
        );
        console.log(`   [Story→Base] Released nonce ${nonce} → ${destinationRecipient} ${ethers.formatUnits(amount, 6)} USDC tx=${tx.hash}`);
        await tx.wait();
      } catch (e) {
        console.error("   [Story→Base] Release failed for nonce", nonce, e.message);
      }
    }
    setTimeout(pollStoryToBase, POLL_INTERVAL_MS);
  }

  console.log("   Listening for LockRequest (Base→Story) and LockRequestBack (Story→Base)...\n");
  pollBaseToStory();
  pollStoryToBase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
