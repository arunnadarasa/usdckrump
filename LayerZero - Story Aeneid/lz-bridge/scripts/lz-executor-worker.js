/**
 * LayerZero Simple Executor Worker for USDCKrumpOFT
 * 
 * Listens for PacketSent events from USDCKrumpOFT and executes messages
 * on destination chain after DVN verification.
 * 
 * Usage (from lz-bridge): npm run lz-executor
 *   Or: LZ_EXECUTOR_KEY=<key> node scripts/lz-executor-worker.js
 *   Loads PRIVATE_KEY from .env if present.
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const POLL_INTERVAL_MS = 10000;
const BASE_SEPOLIA_EID = 84532;
const STORY_AENEID_EID = 1315;

// PacketV1Codec decoding (matches Solidity PacketV1Codec)
// encodedPacket is bytes from event, we decode it
function decodePacket(encodedPacket) {
  if (!encodedPacket || encodedPacket.length < 113) return null; // Minimum packet size (1 + 8 + 4 + 32 + 4 + 32 + 32 = 113)
  
  // Convert to hex string if it's a Uint8Array or Buffer
  const hex = typeof encodedPacket === 'string' ? encodedPacket.slice(2) : ethers.hexlify(encodedPacket).slice(2);
  if (hex.length < 226) return null; // Need at least guid offset
  
  const version = parseInt(hex.slice(0, 2), 16);
  if (version !== 1) return null;
  
  // Extract fields (packet structure: version(1) + nonce(8) + srcEid(4) + sender(32) + dstEid(4) + receiver(32) + guid(32) + message)
  const nonce = BigInt("0x" + hex.slice(2, 18));
  const srcEid = parseInt(hex.slice(18, 26), 16);
  const senderBytes = hex.slice(26, 90);
  const sender = "0x" + senderBytes.slice(-40); // Last 20 bytes (40 hex chars) for address
  const dstEid = parseInt(hex.slice(90, 98), 16);
  const receiverBytes = hex.slice(98, 162);
  const receiver = "0x" + receiverBytes.slice(-40);
  const guid = "0x" + hex.slice(162, 226);
  const message = "0x" + hex.slice(226);
  
  return { version, nonce, srcEid, sender, dstEid, receiver, guid, message };
}

const ENDPOINT_ABI = [
  "event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)",
  "event PacketVerified(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver, bytes32 payloadHash)",
  "event PacketDelivered(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver)",
  "function verifiable(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) calldata _origin, address _receiver) view returns (bool)",
  "function lzReceive(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) calldata _origin, address _receiver, bytes32 _guid, bytes calldata _message, bytes calldata _extraData) payable",
];

async function main() {
  const basePath = "deployments/usdckrump-base-sepolia-latest.json";
  const storyPath = "deployments/usdckrump-story-aeneid-latest.json";
  const baseEndpointPath = "deployments/base-sepolia-latest.json";
  const storyEndpointPath = "deployments/story-aeneid-latest.json";

  if (!fs.existsSync(basePath) || !fs.existsSync(storyPath) || 
      !fs.existsSync(baseEndpointPath) || !fs.existsSync(storyEndpointPath)) {
    console.error("❌ Missing deployment files.");
    process.exit(1);
  }

  const baseOft = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const storyOft = JSON.parse(fs.readFileSync(storyPath, "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync(baseEndpointPath, "utf8"));
  const storyEndpoint = JSON.parse(fs.readFileSync(storyEndpointPath, "utf8"));

  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY";
  const storyRpc = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";

  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const storyProvider = new ethers.JsonRpcProvider(storyRpc);

  const executorKey = process.env.LZ_EXECUTOR_KEY || process.env.PRIVATE_KEY;
  if (!executorKey) {
    console.error("❌ Set LZ_EXECUTOR_KEY or PRIVATE_KEY");
    process.exit(1);
  }
  const baseWallet = new ethers.Wallet(executorKey, baseProvider);
  const storyWallet = new ethers.Wallet(executorKey, storyProvider);

  console.log("⚡ LayerZero Executor Worker for USDCKrumpOFT");
  console.log("   Executor:", baseWallet.address);
  console.log("   Base OFT:", baseOft.address);
  console.log("   Story OFT:", storyOft.address);
  console.log("   Poll interval:", POLL_INTERVAL_MS / 1000, "s\n");

  const baseEndpointContract = new ethers.Contract(baseEndpoint.endpointV2, ENDPOINT_ABI, baseProvider);
  const storyEndpointContract = new ethers.Contract(storyEndpoint.endpointV2, ENDPOINT_ABI, storyProvider);
  const baseEndpointSigner = new ethers.Contract(baseEndpoint.endpointV2, ENDPOINT_ABI, baseWallet);
  const storyEndpointSigner = new ethers.Contract(storyEndpoint.endpointV2, ENDPOINT_ABI, storyWallet);

  // Store pending packets: messageId -> { origin, receiver, guid, message, extraData }
  const pendingPackets = new Map();
  const processedMessages = new Set();

  // Listen for PacketSent on Base Sepolia (Base → Story)
  async function watchBaseToStory() {
    try {
      const toBlock = await baseProvider.getBlockNumber();
      const fromBlock = Math.max(toBlock - 200, 0);

      const sentEvents = await baseEndpointContract.queryFilter(
        baseEndpointContract.filters.PacketSent(),
        fromBlock,
        toBlock
      );

      for (const ev of sentEvents) {
        const { encodedPayload } = ev.args;
        const packetHex = typeof encodedPayload === 'string' ? encodedPayload : ethers.hexlify(encodedPayload);
        const packet = decodePacket(packetHex);
        if (!packet) continue;

        // Check if for our Story OFT
        if (packet.dstEid !== STORY_AENEID_EID) continue;
        const receiverAddr = ethers.getAddress(packet.receiver);
        if (receiverAddr.toLowerCase() !== storyOft.address.toLowerCase()) continue;

        const messageId = `${packet.srcEid}-${packet.sender}-${packet.nonce}`;
        if (pendingPackets.has(messageId)) continue;

        pendingPackets.set(messageId, {
          origin: { srcEid: packet.srcEid, sender: packet.sender, nonce: packet.nonce },
          receiver: receiverAddr,
          guid: packet.guid,
          message: packet.message,
          extraData: "0x",
        });
      }
    } catch (e) {
      console.error("   [Base→Story] Watch error:", e.message);
    }
  }

  // Listen for PacketSent on Story Aeneid (Story → Base)
  async function watchStoryToBase() {
    try {
      const toBlock = await storyProvider.getBlockNumber();
      const fromBlock = Math.max(toBlock - 200, 0);

      const sentEvents = await storyEndpointContract.queryFilter(
        storyEndpointContract.filters.PacketSent(),
        fromBlock,
        toBlock
      );

      for (const ev of sentEvents) {
        const { encodedPayload } = ev.args;
        const packetHex = typeof encodedPayload === 'string' ? encodedPayload : ethers.hexlify(encodedPayload);
        const packet = decodePacket(packetHex);
        if (!packet) continue;

        if (packet.dstEid !== BASE_SEPOLIA_EID) continue;
        const receiverAddr = ethers.getAddress(packet.receiver);
        if (receiverAddr.toLowerCase() !== baseOft.address.toLowerCase()) continue;

        const messageId = `${packet.srcEid}-${packet.sender}-${packet.nonce}`;
        if (pendingPackets.has(messageId)) continue;

        pendingPackets.set(messageId, {
          origin: { srcEid: packet.srcEid, sender: packet.sender, nonce: packet.nonce },
          receiver: receiverAddr,
          guid: packet.guid,
          message: packet.message,
          extraData: "0x",
        });
      }
    } catch (e) {
      console.error("   [Story→Base] Watch error:", e.message);
    }
  }

  // Execute verified packets on Story Aeneid
  async function executeBaseToStory() {
    try {
      const toBlock = await storyProvider.getBlockNumber();
      const fromBlock = Math.max(toBlock - 100, 0);

      const verifiedEvents = await storyEndpointContract.queryFilter(
        storyEndpointContract.filters.PacketVerified(),
        fromBlock,
        toBlock
      );

      for (const ev of verifiedEvents) {
        const { origin, receiver } = ev.args;
        // receiver is bytes32, extract address (last 20 bytes)
        const receiverHex = typeof receiver === 'string' ? receiver.slice(2) : ethers.hexlify(receiver).slice(2);
        const receiverAddr = ethers.getAddress("0x" + receiverHex.slice(-40));
        if (receiverAddr.toLowerCase() !== storyOft.address.toLowerCase()) continue;

        const messageId = `${origin.srcEid}-${origin.sender}-${origin.nonce}`;
        if (processedMessages.has(messageId)) continue;

        const packet = pendingPackets.get(messageId);
        if (!packet) continue;

        try {
          const isVerifiable = await storyEndpointContract.verifiable(origin, receiverAddr);
          if (!isVerifiable) continue;

          // Check if already delivered
          const deliveredFilter = storyEndpointContract.filters.PacketDelivered(origin, receiverAddr);
          const delivered = await storyEndpointContract.queryFilter(deliveredFilter, fromBlock, toBlock);
          if (delivered.length > 0) {
            processedMessages.add(messageId);
            pendingPackets.delete(messageId);
            continue;
          }

          console.log(`   [Base→Story] Executing: nonce=${origin.nonce}, guid=${packet.guid.slice(0, 10)}...`);
          
          // Execute lzReceive
          // Convert hex strings to proper bytes format
          const guidBytes = ethers.getBytes(packet.guid);
          const messageBytes = ethers.getBytes(packet.message);
          const extraDataBytes = packet.extraData === "0x" ? "0x" : ethers.getBytes(packet.extraData);
          
          const tx = await storyEndpointSigner.lzReceive(
            origin,
            receiverAddr,
            guidBytes,
            messageBytes,
            extraDataBytes,
            { gasLimit: 500000 }
          );
          await tx.wait();
          
          console.log(`   ✅ Executed: ${tx.hash}`);
          processedMessages.add(messageId);
          pendingPackets.delete(messageId);
        } catch (e) {
          if (!e.message.includes("already delivered") && !e.message.includes("not verifiable")) {
            console.error(`   [Base→Story] Execute error:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error("   [Base→Story] Execute error:", e.message);
    }
  }

  // Execute verified packets on Base Sepolia
  async function executeStoryToBase() {
    try {
      const toBlock = await baseProvider.getBlockNumber();
      const fromBlock = Math.max(toBlock - 100, 0);

      const verifiedEvents = await baseEndpointContract.queryFilter(
        baseEndpointContract.filters.PacketVerified(),
        fromBlock,
        toBlock
      );

      for (const ev of verifiedEvents) {
        const { origin, receiver } = ev.args;
        const receiverHex = typeof receiver === 'string' ? receiver.slice(2) : ethers.hexlify(receiver).slice(2);
        const receiverAddr = ethers.getAddress("0x" + receiverHex.slice(-40));
        if (receiverAddr.toLowerCase() !== baseOft.address.toLowerCase()) continue;

        const messageId = `${origin.srcEid}-${origin.sender}-${origin.nonce}`;
        if (processedMessages.has(messageId)) continue;

        const packet = pendingPackets.get(messageId);
        if (!packet) continue;

        try {
          const isVerifiable = await baseEndpointContract.verifiable(origin, receiverAddr);
          if (!isVerifiable) continue;

          const deliveredFilter = baseEndpointContract.filters.PacketDelivered(origin, receiverAddr);
          const delivered = await baseEndpointContract.queryFilter(deliveredFilter, fromBlock, toBlock);
          if (delivered.length > 0) {
            processedMessages.add(messageId);
            pendingPackets.delete(messageId);
            continue;
          }

          console.log(`   [Story→Base] Executing: nonce=${origin.nonce}, guid=${packet.guid.slice(0, 10)}...`);
          
          const guidBytes = ethers.getBytes(packet.guid);
          const messageBytes = ethers.getBytes(packet.message);
          const extraDataBytes = packet.extraData === "0x" ? "0x" : ethers.getBytes(packet.extraData);
          
          const tx = await baseEndpointSigner.lzReceive(
            origin,
            receiverAddr,
            guidBytes,
            messageBytes,
            extraDataBytes,
            { gasLimit: 500000 }
          );
          await tx.wait();
          
          console.log(`   ✅ Executed: ${tx.hash}`);
          processedMessages.add(messageId);
          pendingPackets.delete(messageId);
        } catch (e) {
          if (!e.message.includes("already delivered") && !e.message.includes("not verifiable")) {
            console.error(`   [Story→Base] Execute error:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error("   [Story→Base] Execute error:", e.message);
    }
  }

  console.log("   Listening for PacketSent/Verified (Base↔Story)...\n");

  async function poll() {
    await watchBaseToStory();
    await watchStoryToBase();
    await executeBaseToStory();
    await executeStoryToBase();
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  poll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
