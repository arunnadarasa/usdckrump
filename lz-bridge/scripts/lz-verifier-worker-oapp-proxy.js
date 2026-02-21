/**
 * LayerZero Verifier Worker for OAppProxyOFT
 *
 * Watches PacketSent on Base Sepolia (custom or official endpoint), builds packetHeader
 * and payloadHash (PacketV1Codec), then on Story Aeneid:
 *   1. Calls VerifierDVN.submitVerification(packetHeader, payloadHash, confirmations)
 *      so ReceiveUln302.verify() is invoked with msg.sender = VerifierDVN (the configured DVN).
 *   2. Calls ReceiveUln302.commitVerification(packetHeader, payloadHash)
 *      so the endpoint emits PacketVerified.
 * The executor worker then sees PacketVerified and runs lzReceive.
 *
 * Usage:
 *   LZ_VERIFIER_KEY=<key> node scripts/lz-verifier-worker-oapp-proxy.js
 *   Or: npm run lz-verifier:oapp-proxy
 *
 * Requires: BASE_SEPOLIA_RPC, STORY_AENEID_RPC. Loads .env.
 * Uses 150-block range for eth_getLogs (free-tier RPC).
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const POLL_INTERVAL_MS = 10000;
const MAX_BLOCK_RANGE = 150;
const CATCHUP_BLOCKS = 200; // Last N blocks on startup (150-block chunks = 2 chunks)
const PACKET_HEADER_LENGTH = 81; // PacketV1Codec: version(1) + nonce(8) + path(72)
const BASE_SEPOLIA_EID = 40245;
const STORY_AENEID_EID = 1315;

/** @param {string|Uint8Array} encodedPayload - full packet (header + payload) */
function buildHeaderAndPayloadHash(encodedPayload) {
  const hex = typeof encodedPayload === "string"
    ? encodedPayload.startsWith("0x") ? encodedPayload.slice(2) : encodedPayload
    : ethers.hexlify(encodedPayload).slice(2);
  if (hex.length < PACKET_HEADER_LENGTH * 2) return null;
  const headerHex = hex.slice(0, PACKET_HEADER_LENGTH * 2);
  const payloadHex = hex.slice(PACKET_HEADER_LENGTH * 2);
  const packetHeader = "0x" + headerHex;
  const payloadHash = ethers.keccak256("0x" + payloadHex);
  return { packetHeader, payloadHash };
}

/** PacketV1Codec: srcEid at bytes 9-12, receiver at 49-81 (last 20 bytes = B20) */
function getReceiverAndSrcEidFromHeader(packetHeader) {
  const h = packetHeader.startsWith("0x") ? packetHeader.slice(2) : packetHeader;
  const srcEid = parseInt(h.slice(9 * 2, 13 * 2), 16);
  const receiver = ethers.getAddress("0x" + h.slice(49 * 2, 81 * 2).slice(-40));
  return { receiver, srcEid };
}

const ENDPOINT_ABI = [
  "event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)",
];

const RECEIVE_ULN_ABI = [
  "function verify(bytes calldata _packetHeader, bytes32 _payloadHash, uint64 _confirmations) external",
  "function commitVerification(bytes calldata _packetHeader, bytes32 _payloadHash) external",
  "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  "function verifiable(tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs) _config, bytes32 _headerHash, bytes32 _payloadHash) view returns (bool)",
];

const VERIFIER_DVN_ABI = [
  "function submitVerification(bytes calldata _packetHeader, bytes32 _payloadHash, uint64 _confirmations) external",
  "function submitAndCommit(bytes calldata _packetHeader, bytes32 _payloadHash, uint64 _confirmations) external",
];

/** Retry an async fn on 429 / compute-units rate limit. */
async function withRetry429(fn, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : "";
      const is429 = (e && (e.code === 429 || e.statusCode === 429)) || /compute units|exceeded/i.test(msg);
      if (is429 && i < maxRetries) {
        const waitMs = 3000 + i * 2000;
        console.log(`   ⏳ Rate limited (429), retrying in ${waitMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        throw e;
      }
    }
  }
}

/** Get gas options for Story Aeneid with a fee bump so replacement txs are accepted. */
async function getVerifierGasOptions(provider, bumpPercent = 120) {
  const feeData = await provider.getFeeData();
  const gasOpts = {
    maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * BigInt(bumpPercent) / 100n) : undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * BigInt(bumpPercent) / 100n) : undefined,
    gasLimit: 400000,
  };
  return Object.fromEntries(Object.entries(gasOpts).filter(([, v]) => v != null));
}

async function main() {
  const baseEndpointPath = "deployments/base-sepolia-own-latest.json";
  const baseOappPath = "deployments/oapp-proxy-oft-baseSepolia-latest.json";
  const storyOappPath = "deployments/oapp-proxy-oft-storyAeneid-latest.json";
  const storyPath = "deployments/story-aeneid-latest.json";

  if (
    !fs.existsSync(baseEndpointPath) ||
    !fs.existsSync(baseOappPath) ||
    !fs.existsSync(storyOappPath) ||
    !fs.existsSync(storyPath)
  ) {
    console.error("❌ Missing deployment files. Need: base-sepolia-own-latest.json, oapp-proxy-oft-*-latest.json, story-aeneid-latest.json");
    process.exit(1);
  }

  const baseDeploy = JSON.parse(fs.readFileSync(baseEndpointPath, "utf8"));
  const storyOapp = JSON.parse(fs.readFileSync(storyOappPath, "utf8"));
  const storyDeploy = JSON.parse(fs.readFileSync(storyPath, "utf8"));

  const verifierDvnAddress = storyDeploy.verifierDVN || process.env.LZ_VERIFIER_DVN;
  if (!verifierDvnAddress) {
    console.error("❌ Set VerifierDVN address: add 'verifierDVN' to deployments/story-aeneid-latest.json or set LZ_VERIFIER_DVN");
    process.exit(1);
  }

  const baseRpc =
    process.env.BASE_SEPOLIA_WS_RPC ||
    process.env.BASE_SEPOLIA_RPC ||
    "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY";
  const storyRpc = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";

  const baseProvider =
    baseRpc.startsWith("wss://") || baseRpc.startsWith("ws://")
      ? new ethers.WebSocketProvider(baseRpc)
      : new ethers.JsonRpcProvider(baseRpc);
  const storyProvider = new ethers.JsonRpcProvider(storyRpc);

  const verifierKey = process.env.LZ_VERIFIER_KEY || process.env.PRIVATE_KEY;
  if (!verifierKey) {
    console.error("❌ Set LZ_VERIFIER_KEY or PRIVATE_KEY (wallet with gas on Story Aeneid)");
    process.exit(1);
  }
  const storyWallet = new ethers.Wallet(verifierKey, storyProvider);

  const storyReceiver = ethers.getAddress(storyOapp.oappProxyOft);
  const receiveUln302 = storyDeploy.receiveUln302;

  const baseEndpoint = new ethers.Contract(baseDeploy.endpointV2, ENDPOINT_ABI, baseProvider);
  const verifierDvn = new ethers.Contract(ethers.getAddress(verifierDvnAddress), VERIFIER_DVN_ABI, storyWallet);
  const receiveUln = new ethers.Contract(receiveUln302, RECEIVE_ULN_ABI, storyWallet);
  const receiveUlnView = new ethers.Contract(receiveUln302, RECEIVE_ULN_ABI, storyProvider);

  console.log("🔐 LayerZero Verifier Worker (OAppProxyOFT)");
  console.log("   Verifier wallet:", storyWallet.address);
  console.log("   Base endpoint:", baseDeploy.endpointV2);
  console.log("   Story ReceiveUln302:", receiveUln302);
  console.log("   VerifierDVN:", verifierDvnAddress);
  console.log("   Story OAppProxyOFT:", storyReceiver);
  console.log("   Poll interval:", POLL_INTERVAL_MS / 1000, "s\n");

  const verifiedMessageIds = new Set();
  let lastBaseBlock = 0;

  const CATCHUP_CHUNK_DELAY_MS = 50;

  async function catchupScan() {
    console.log(`   🔍 Catch-up: last ${CATCHUP_BLOCKS} blocks (${MAX_BLOCK_RANGE}-block chunks)...`);
    const toBlock = await baseProvider.getBlockNumber();
    const fromStart = Math.max(toBlock - CATCHUP_BLOCKS, 0);
    for (let from = fromStart; from < toBlock; from += MAX_BLOCK_RANGE) {
      if (from > fromStart) await new Promise((r) => setTimeout(r, CATCHUP_CHUNK_DELAY_MS));
      const to = Math.min(from + MAX_BLOCK_RANGE - 1, toBlock);
      try {
        const events = await withRetry429(() =>
          baseEndpoint.queryFilter(baseEndpoint.filters.PacketSent(), from, to)
        );
        for (const ev of events) {
          const { encodedPayload } = ev.args;
          const built = buildHeaderAndPayloadHash(encodedPayload);
          if (!built) continue;
          const hex = typeof encodedPayload === "string" ? encodedPayload.slice(2) : ethers.hexlify(encodedPayload).slice(2);
          const dstEid = parseInt(hex.slice(90, 98), 16);
          const receiver = "0x" + hex.slice(98, 162).slice(-40);
          if (dstEid !== STORY_AENEID_EID || ethers.getAddress(receiver).toLowerCase() !== storyReceiver.toLowerCase()) continue;
          const sender = "0x" + hex.slice(26, 90).slice(-40);
          const nonce = BigInt("0x" + hex.slice(2, 18));
          const messageId = `${BASE_SEPOLIA_EID}-${ethers.zeroPadValue(sender, 32)}-${nonce}`;
          if (verifiedMessageIds.has(messageId)) continue;
          const { srcEid } = getReceiverAndSrcEidFromHeader(built.packetHeader);
          const config = await receiveUlnView.getUlnConfig(ethers.getAddress(receiver), srcEid);
          const confirmations = Math.max(1, config.confirmations != null ? Number(config.confirmations) : 0);
          let gasOpts, tx;
          try {
            gasOpts = await getVerifierGasOptions(storyProvider, 120);
            tx = await verifierDvn.submitAndCommit(built.packetHeader, built.payloadHash, confirmations, gasOpts);
            await tx.wait();
            verifiedMessageIds.add(messageId);
            console.log(`   ✅ Catch-up verified: nonce=${nonce}`);
          } catch (e) {
            const isReplacement = e.code === "REPLACEMENT_UNDERPRICED" || (e.message && e.message.includes("replacement fee"));
            if (isReplacement) {
              try {
                gasOpts = await getVerifierGasOptions(storyProvider, 150);
                tx = await verifierDvn.submitAndCommit(built.packetHeader, built.payloadHash, confirmations, gasOpts);
                await tx.wait();
                verifiedMessageIds.add(messageId);
                console.log(`   ✅ Catch-up verified (retry): nonce=${nonce}`);
              } catch (retryErr) {
                if (retryErr.message && (retryErr.message.includes("LZ_ULN_Verifying") || retryErr.message.includes("already"))) {
                  verifiedMessageIds.add(messageId);
                } else {
                  console.error(`   ⚠️  Catch-up verify error (retry):`, retryErr.message);
                }
              }
            } else if (e.message && (e.message.includes("LZ_ULN_Verifying") || e.message.includes("already"))) {
              verifiedMessageIds.add(messageId);
            } else {
              console.error(`   ⚠️  Catch-up verify error:`, e.message);
            }
          }
        }
      } catch (e) {
        console.error(`   ⚠️  Catch-up scan error (${from}-${to}):`, e.message);
      }
    }
    lastBaseBlock = Math.max(toBlock - MAX_BLOCK_RANGE, 0);
    console.log(`   ✅ Catch-up done. ${verifiedMessageIds.size} verified.\n`);
  }

  async function poll() {
    try {
      const toBlock = await baseProvider.getBlockNumber();
      if (lastBaseBlock === 0) lastBaseBlock = Math.max(toBlock - MAX_BLOCK_RANGE, 0);
      const fromBlock = lastBaseBlock + 1;
      const endBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, toBlock);
      if (fromBlock > endBlock) {
        setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      const events = await withRetry429(() =>
        baseEndpoint.queryFilter(baseEndpoint.filters.PacketSent(), fromBlock, endBlock)
      );
      lastBaseBlock = endBlock;

      for (const ev of events) {
        const { encodedPayload } = ev.args;
        const built = buildHeaderAndPayloadHash(encodedPayload);
        if (!built) continue;
        const hex = typeof encodedPayload === "string" ? encodedPayload.slice(2) : ethers.hexlify(encodedPayload).slice(2);
        const dstEid = parseInt(hex.slice(90, 98), 16);
        const receiver = "0x" + hex.slice(98, 162).slice(-40);
        if (dstEid !== STORY_AENEID_EID || ethers.getAddress(receiver).toLowerCase() !== storyReceiver.toLowerCase()) continue;
        const sender = "0x" + hex.slice(26, 90).slice(-40);
        const nonce = BigInt("0x" + hex.slice(2, 18));
        const messageId = `${BASE_SEPOLIA_EID}-${ethers.zeroPadValue(sender, 32)}-${nonce}`;
        if (verifiedMessageIds.has(messageId)) continue;

        const { srcEid } = getReceiverAndSrcEidFromHeader(built.packetHeader);
        const config = await receiveUlnView.getUlnConfig(ethers.getAddress(receiver), srcEid);
        const confirmations = Math.max(1, config.confirmations != null ? Number(config.confirmations) : 0);
        let gasOpts, tx;
        try {
          gasOpts = await getVerifierGasOptions(storyProvider, 120);
          tx = await verifierDvn.submitAndCommit(built.packetHeader, built.payloadHash, confirmations, gasOpts);
          await tx.wait();
          verifiedMessageIds.add(messageId);
          console.log(`   ✅ Verified + committed: nonce=${nonce} tx=${tx.hash}`);
        } catch (e) {
          const isReplacement = e.code === "REPLACEMENT_UNDERPRICED" || (e.message && e.message.includes("replacement fee"));
          if (isReplacement) {
            try {
              gasOpts = await getVerifierGasOptions(storyProvider, 150);
              tx = await verifierDvn.submitAndCommit(built.packetHeader, built.payloadHash, confirmations, gasOpts);
              await tx.wait();
              verifiedMessageIds.add(messageId);
              console.log(`   ✅ Verified + committed (retry): nonce=${nonce} tx=${tx.hash}`);
            } catch (retryErr) {
              if (retryErr.message && (retryErr.message.includes("LZ_ULN_Verifying") || retryErr.message.includes("already"))) {
                verifiedMessageIds.add(messageId);
              } else {
                console.error(`   ⚠️  Verify/commit error (nonce=${nonce}, retry):`, retryErr.message);
              }
            }
          } else if (e.message && (e.message.includes("LZ_ULN_Verifying") || e.message.includes("already"))) {
            verifiedMessageIds.add(messageId);
          } else {
            console.error(`   ⚠️  Verify/commit error (nonce=${nonce}):`, e.message);
          }
        }
      }
    } catch (e) {
      console.error("   [Verifier] Poll error:", e.message);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  console.log("   Watching PacketSent (Base) → verify + commitVerification (Story) → PacketVerified\n");
  await catchupScan();
  poll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
