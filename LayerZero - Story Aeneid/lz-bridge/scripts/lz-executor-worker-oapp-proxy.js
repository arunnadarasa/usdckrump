/**
 * LayerZero Executor Worker for OAppProxyOFT with self-deployed endpoint
 *
 * Watches PacketSent on the CUSTOM endpoint (Base Sepolia), then executes
 * lzReceive on Story Aeneid after PacketVerified. Use this when bridging
 * via the self-deployed endpoint (base-sepolia-own-latest.json).
 *
 * Usage:
 *   LZ_EXECUTOR_KEY=<key> node scripts/lz-executor-worker-oapp-proxy.js
 *   Or: npm run lz-executor:oapp-proxy
 *
 * Requires: BASE_SEPOLIA_RPC, optional STORY_AENEID_RPC. Loads .env.
 * Uses a 10-block range for eth_getLogs to stay within free-tier RPC limits.
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const POLL_INTERVAL_MS = 10000;
const MAX_BLOCK_RANGE = 50; // 50-block chunks for catch-up and poll
const CATCHUP_BLOCKS = 200; // On startup, scan last N blocks (50-block chunks = 4 chunks)
const PROACTIVE_FETCH_BLOCKS = 2000; // When we need nextNonce but have no packet, scan this many Base blocks to find PacketSent
const BASE_SEPOLIA_EID = 40245; // LayerZero EID (not chain ID)
const STORY_AENEID_EID = 1315;

/** Canonical messageId so lookup matches between PacketSent (Base) and proactive execute (same sender, any casing). */
function toMessageId(srcEid, senderBytes32, nonce) {
  const s = typeof senderBytes32 === "string" ? senderBytes32 : ethers.hexlify(senderBytes32);
  return `${srcEid}-${s.toLowerCase()}-${nonce}`;
}

function decodePacket(encodedPacket) {
  if (!encodedPacket || encodedPacket.length < 113) return null;
  const hex = typeof encodedPacket === "string" ? encodedPacket.slice(2) : ethers.hexlify(encodedPacket).slice(2);
  if (hex.length < 226) return null;
  const version = parseInt(hex.slice(0, 2), 16);
  if (version !== 1) return null;
  const nonce = BigInt("0x" + hex.slice(2, 18));
  const srcEid = parseInt(hex.slice(18, 26), 16);
  const sender = "0x" + hex.slice(26, 90).slice(-40);
  const dstEid = parseInt(hex.slice(90, 98), 16);
  const receiver = "0x" + hex.slice(98, 162).slice(-40);
  const guid = "0x" + hex.slice(162, 226);
  const message = "0x" + hex.slice(226);
  return { version, nonce, srcEid, sender, dstEid, receiver, guid, message };
}

const ENDPOINT_ABI = [
  "event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)",
  "event PacketVerified(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver, bytes32 payloadHash)",
  "event PacketDelivered(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) origin, address receiver)",
  "function verifiable(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) calldata _origin, address _receiver) view returns (bool)",
  "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
  "function lzReceive(tuple(uint32 srcEid, bytes32 sender, uint64 nonce) calldata _origin, address _receiver, bytes32 _guid, bytes calldata _message, bytes calldata _extraData) payable",
];

async function main() {
  const baseOwnPath = "deployments/base-sepolia-own-latest.json";
  const baseOappPath = "deployments/oapp-proxy-oft-baseSepolia-latest.json";
  const storyOappPath = "deployments/oapp-proxy-oft-storyAeneid-latest.json";
  const storyEndpointPath = "deployments/story-aeneid-latest.json";

  if (
    !fs.existsSync(baseOwnPath) ||
    !fs.existsSync(baseOappPath) ||
    !fs.existsSync(storyOappPath) ||
    !fs.existsSync(storyEndpointPath)
  ) {
    console.error("❌ Missing deployment files. Need: base-sepolia-own-latest.json, oapp-proxy-oft-*-latest.json, story-aeneid-latest.json");
    process.exit(1);
  }

  const baseOwn = JSON.parse(fs.readFileSync(baseOwnPath, "utf8"));
  const baseOapp = JSON.parse(fs.readFileSync(baseOappPath, "utf8"));
  const storyOapp = JSON.parse(fs.readFileSync(storyOappPath, "utf8"));
  const storyEndpoint = JSON.parse(fs.readFileSync(storyEndpointPath, "utf8"));

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

  const executorKey = process.env.LZ_EXECUTOR_KEY || process.env.PRIVATE_KEY;
  if (!executorKey) {
    console.error("❌ Set LZ_EXECUTOR_KEY or PRIVATE_KEY (wallet with gas on both chains)");
    process.exit(1);
  }
  const baseWallet = new ethers.Wallet(executorKey, baseProvider);
  const storyWallet = new ethers.Wallet(executorKey, storyProvider);

  console.log("⚡ LayerZero Executor Worker (OAppProxyOFT + custom endpoint)");
  console.log("   Executor:", baseWallet.address);
  console.log("   Base endpoint (custom):", baseOwn.endpointV2);
  console.log("   Base OAppProxyOFT:", baseOapp.oappProxyOft);
  console.log("   Story endpoint:", storyEndpoint.endpointV2);
  console.log("   Story OAppProxyOFT:", storyOapp.oappProxyOft);
  console.log("   Poll interval:", POLL_INTERVAL_MS / 1000, "s\n");

  const baseEndpointContract = new ethers.Contract(baseOwn.endpointV2, ENDPOINT_ABI, baseProvider);
  const storyEndpointContract = new ethers.Contract(storyEndpoint.endpointV2, ENDPOINT_ABI, storyProvider);
  const storyEndpointSigner = new ethers.Contract(storyEndpoint.endpointV2, ENDPOINT_ABI, storyWallet);

  const pendingPackets = new Map();
  const processedMessages = new Set();
  const unverifiedNonceLogged = new Set();
  const lastFetchAttempt = new Map();
  const FETCH_COOLDOWN_MS = 90000;
  let lastBaseBlock = 0;
  let lastStoryBlock = 0;

  const storyReceiver = ethers.getAddress(storyOapp.oappProxyOft);
  const baseSenderBytes32 = ethers.zeroPadValue(ethers.getAddress(baseOapp.oappProxyOft), 32);

  /** Scan Base for PacketSent(nonce) when we don't have it in pendingPackets (e.g. executor started late). */
  async function fetchPacketFromBase(wantNonce) {
    const toBlock = await baseProvider.getBlockNumber();
    const fromStart = Math.max(toBlock - PROACTIVE_FETCH_BLOCKS, 0);
    for (let from = fromStart; from < toBlock; from += MAX_BLOCK_RANGE) {
      const to = Math.min(from + MAX_BLOCK_RANGE - 1, toBlock);
      try {
        const events = await baseEndpointContract.queryFilter(baseEndpointContract.filters.PacketSent(), from, to);
        for (const ev of events) {
          const packetHex = typeof ev.args.encodedPayload === "string" ? ev.args.encodedPayload : ethers.hexlify(ev.args.encodedPayload);
          const p = decodePacket(packetHex);
          if (!p || p.dstEid !== STORY_AENEID_EID || BigInt(p.nonce) !== BigInt(wantNonce)) continue;
          const receiverAddr = ethers.getAddress(p.receiver);
          if (receiverAddr.toLowerCase() !== storyReceiver.toLowerCase()) continue;
          return {
            origin: { srcEid: p.srcEid, sender: p.sender, nonce: p.nonce },
            receiver: receiverAddr,
            guid: p.guid,
            message: p.message,
            extraData: "0x",
          };
        }
      } catch (e) {
        // skip chunk
      }
    }
    return null;
  }

  // Proactive execute: endpoint expects nextNonce but PacketVerified was in a past window; execute from pendingPackets if we have it.
  async function tryProactiveExecute() {
    try {
      const nextNonce = (await storyEndpointContract.inboundNonce(storyReceiver, BASE_SEPOLIA_EID, baseSenderBytes32)) + 1n;
      const messageId = toMessageId(BASE_SEPOLIA_EID, baseSenderBytes32, nextNonce);
      if (processedMessages.has(messageId)) return;
      let packet = pendingPackets.get(messageId);
      if (!packet) {
        const now = Date.now();
        const last = lastFetchAttempt.get(String(nextNonce)) || 0;
        if (now - last < FETCH_COOLDOWN_MS) {
          return;
        }
        lastFetchAttempt.set(String(nextNonce), now);
        const fetched = await fetchPacketFromBase(nextNonce);
        if (fetched) {
          pendingPackets.set(messageId, fetched);
          packet = fetched;
          console.log(`   [Base→Story] Fetched missing packet from Base (nonce=${nextNonce}, ${PROACTIVE_FETCH_BLOCKS} blocks)`);
        } else {
          console.log(`   [Base→Story] No PacketSent for nonce=${nextNonce} in last ${PROACTIVE_FETCH_BLOCKS} Base blocks (waiting for send; will retry in ${FETCH_COOLDOWN_MS / 1000}s)`);
        }
      }
      if (!packet) return;
      const originTuple = { srcEid: packet.origin.srcEid, sender: baseSenderBytes32, nonce: packet.origin.nonce };
      const receiverAddr = storyReceiver;
      const isVerifiable = await storyEndpointContract.verifiable(originTuple, receiverAddr);
      if (!isVerifiable) return;
      const toBlock = await storyProvider.getBlockNumber();
      const fromBlock = Math.max(toBlock - 50, 0);
      const deliveredFilter = storyEndpointContract.filters.PacketDelivered(null, null);
      const deliveredRaw = await storyEndpointContract.queryFilter(deliveredFilter, fromBlock, toBlock);
      const delivered = deliveredRaw.filter(
        (ev) =>
          ev.args.origin.srcEid === originTuple.srcEid &&
          String(ev.args.origin.sender).toLowerCase() === baseSenderBytes32.toLowerCase() &&
          ev.args.origin.nonce === originTuple.nonce &&
          String(ev.args.receiver).toLowerCase() === receiverAddr.toLowerCase()
      );
      if (delivered.length > 0) {
        processedMessages.add(messageId);
        pendingPackets.delete(messageId);
        return;
      }
      // Re-read nextNonce immediately before execute; endpoint may have advanced (e.g. 40 already executed) while we fetched the packet.
      const nextNonceNow = (await storyEndpointContract.inboundNonce(receiverAddr, BASE_SEPOLIA_EID, baseSenderBytes32)) + 1n;
      if (BigInt(packet.origin.nonce) !== nextNonceNow) {
        if (BigInt(packet.origin.nonce) < nextNonceNow) {
          processedMessages.add(messageId);
          pendingPackets.delete(messageId);
        }
        return;
      }
      console.log(`   [Base→Story] Executing (proactive): nonce=${packet.origin.nonce}, guid=${packet.guid.slice(0, 10)}...`);
      const extraDataHex = packet.extraData === "0x" ? "0x" : (typeof packet.extraData === "string" ? packet.extraData : ethers.hexlify(packet.extraData));
      const data = storyEndpointSigner.interface.encodeFunctionData("lzReceive", [
        originTuple,
        receiverAddr,
        packet.guid,
        packet.message,
        extraDataHex,
      ]);
      const PAYLOAD_HASH_RETRY_MS = 2500;
      const PAYLOAD_HASH_RETRIES = 2;
      let staticOk = false;
      for (let attempt = 0; attempt <= PAYLOAD_HASH_RETRIES && !staticOk; attempt++) {
        // Re-read nextNonce each iteration so we skip if another path (or earlier attempt) already delivered this nonce (avoids double-execute revert).
        const nextNonceNowLoop = (await storyEndpointContract.inboundNonce(receiverAddr, BASE_SEPOLIA_EID, baseSenderBytes32)) + 1n;
        if (BigInt(packet.origin.nonce) < nextNonceNowLoop) {
          processedMessages.add(messageId);
          pendingPackets.delete(messageId);
          return;
        }
        try {
          await storyProvider.call({ to: storyEndpoint.endpointV2, from: storyWallet.address, data, gasLimit: 500000 });
          staticOk = true;
        } catch (staticErr) {
          const reason = staticErr.data || staticErr.error?.data || staticErr.message || String(staticErr);
          const reasonStr = typeof reason === "string" ? reason : "";
          const isInvalidNonce = reasonStr.slice(0, 10) === "0xc09b6350";
          const revertNonce = isInvalidNonce && reasonStr.length >= 74 ? parseInt(reasonStr.slice(-16), 16) : null;
          const isNoPayloadHash = isInvalidNonce && revertNonce !== null && Number(packet.origin.nonce) === revertNonce;
          if (isNoPayloadHash && attempt < PAYLOAD_HASH_RETRIES) {
            console.log(`   [Base→Story] Waiting for verifier to commit nonce=${revertNonce} (retry in ${PAYLOAD_HASH_RETRY_MS / 1000}s, attempt ${attempt + 1}/${PAYLOAD_HASH_RETRIES + 1})...`);
            await new Promise((r) => setTimeout(r, PAYLOAD_HASH_RETRY_MS));
            continue;
          }
          if (isNoPayloadHash) {
            if (!unverifiedNonceLogged.has(messageId)) {
              unverifiedNonceLogged.add(messageId);
              console.error(`   [Base→Story] Packet for nonce=${revertNonce} not verified on Story after ${PAYLOAD_HASH_RETRIES + 1} attempts. Restart verifier so it catch-up commits this nonce, then executor will retry.`);
            }
          } else {
            console.error(`   [Base→Story] Execute would revert:`, reason);
          }
          return;
        }
      }
      // Re-check immediately before sending tx; another path may have executed this nonce while we were in the retry loop.
      const nextNonceBeforeTx = (await storyEndpointContract.inboundNonce(receiverAddr, BASE_SEPOLIA_EID, baseSenderBytes32)) + 1n;
      if (BigInt(packet.origin.nonce) < nextNonceBeforeTx) {
        processedMessages.add(messageId);
        pendingPackets.delete(messageId);
        return;
      }
      const tx = await storyWallet.sendTransaction({ to: storyEndpoint.endpointV2, data, gasLimit: 500000 });
      await tx.wait();
      console.log(`   ✅ Executed (proactive): ${tx.hash}`);
      processedMessages.add(messageId);
      pendingPackets.delete(messageId);
    } catch (e) {
      if (!e.message.includes("already delivered") && !e.message.includes("not verifiable")) {
        console.error("   [Base→Story] Proactive execute error:", e.message);
      }
    }
  }

  // Catch-up scan: scan backwards in 10-block chunks to find recent messages
  async function catchupScan() {
    console.log(`   🔍 Catch-up scan: scanning last ${CATCHUP_BLOCKS} blocks (${Math.ceil(CATCHUP_BLOCKS / MAX_BLOCK_RANGE)} chunks)...`);
    
    const baseCurrentBlock = await baseProvider.getBlockNumber();
    const storyCurrentBlock = await storyProvider.getBlockNumber();
    
    // Scan Base Sepolia backwards for PacketSent
    const baseStartBlock = Math.max(baseCurrentBlock - CATCHUP_BLOCKS, 0);
    let baseScanned = 0;
    for (let fromBlock = baseStartBlock; fromBlock < baseCurrentBlock; fromBlock += MAX_BLOCK_RANGE) {
      const endBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, baseCurrentBlock);
      try {
        const sentEvents = await baseEndpointContract.queryFilter(
          baseEndpointContract.filters.PacketSent(),
          fromBlock,
          endBlock
        );
        
        for (const ev of sentEvents) {
          const { encodedPayload } = ev.args;
          const packetHex = typeof encodedPayload === "string" ? encodedPayload : ethers.hexlify(encodedPayload);
          const packet = decodePacket(packetHex);
          if (!packet) continue;

          if (packet.dstEid !== STORY_AENEID_EID) continue;
          const receiverAddr = ethers.getAddress(packet.receiver);
          if (receiverAddr.toLowerCase() !== storyReceiver.toLowerCase()) continue;

          const senderBytes32 = ethers.zeroPadValue(ethers.getAddress(packet.sender), 32);
          const messageId = toMessageId(packet.srcEid, senderBytes32, packet.nonce);
          if (pendingPackets.has(messageId)) continue;

          pendingPackets.set(messageId, {
            origin: { srcEid: packet.srcEid, sender: packet.sender, nonce: packet.nonce },
            receiver: receiverAddr,
            guid: packet.guid,
            message: packet.message,
            extraData: "0x",
          });
          console.log(`   📦 Found PacketSent: nonce=${packet.nonce}, guid=${packet.guid.slice(0, 10)}...`);
        }
        baseScanned += (endBlock - fromBlock + 1);
      } catch (e) {
        console.error(`   ⚠️  Catch-up scan error (blocks ${fromBlock}-${endBlock}):`, e.message);
      }
    }
    
    // Scan Story Aeneid backwards for PacketVerified
    const storyStartBlock = Math.max(storyCurrentBlock - CATCHUP_BLOCKS, 0);
    let storyScanned = 0;
    for (let fromBlock = storyStartBlock; fromBlock < storyCurrentBlock; fromBlock += MAX_BLOCK_RANGE) {
      const endBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, storyCurrentBlock);
      try {
        const verifiedEvents = await storyEndpointContract.queryFilter(
          storyEndpointContract.filters.PacketVerified(),
          fromBlock,
          endBlock
        );
        
        for (const ev of verifiedEvents) {
          const { origin, receiver } = ev.args;
          const originTuple = { srcEid: origin.srcEid, sender: origin.sender, nonce: origin.nonce };
          const receiverHex = typeof receiver === "string" ? receiver.slice(2) : ethers.hexlify(receiver).slice(2);
          const receiverAddr = ethers.getAddress("0x" + receiverHex.slice(-40));
          if (receiverAddr.toLowerCase() !== storyReceiver.toLowerCase()) continue;

          const originSenderBytes32 = typeof origin.sender === "string" ? origin.sender : "0x" + ethers.hexlify(origin.sender).slice(2).padStart(64, "0");
          const messageId = toMessageId(origin.srcEid, originSenderBytes32, origin.nonce);
          if (processedMessages.has(messageId)) continue;

          const packet = pendingPackets.get(messageId);
          if (!packet) continue;

          try {
            const isVerifiable = await storyEndpointContract.verifiable(originTuple, receiverAddr);
            if (!isVerifiable) continue;

            const nextNonce = (await storyEndpointContract.inboundNonce(receiverAddr, originTuple.srcEid, originTuple.sender)) + 1n;
            if (BigInt(originTuple.nonce) !== nextNonce) continue;

            const deliveredFilter = storyEndpointContract.filters.PacketDelivered(null, null);
            const deliveredRaw = await storyEndpointContract.queryFilter(deliveredFilter, fromBlock, endBlock);
            const delivered = deliveredRaw.filter(
              (ev) =>
                ev.args.origin.srcEid === originTuple.srcEid &&
                ev.args.origin.sender === originTuple.sender &&
                ev.args.origin.nonce === originTuple.nonce &&
                String(ev.args.receiver).toLowerCase() === receiverAddr.toLowerCase()
            );
            if (delivered.length > 0) {
              processedMessages.add(messageId);
              pendingPackets.delete(messageId);
              continue;
            }

            console.log(`   ⚡ Catch-up: Found verified packet, executing: nonce=${origin.nonce}, guid=${packet.guid.slice(0, 10)}...`);

            const extraDataHex = packet.extraData === "0x" ? "0x" : (typeof packet.extraData === "string" ? packet.extraData : ethers.hexlify(packet.extraData));
            const data = storyEndpointSigner.interface.encodeFunctionData("lzReceive", [
              originTuple,
              receiverAddr,
              packet.guid,
              packet.message,
              extraDataHex,
            ]);
            const nextNonceBeforeCatchupTx = (await storyEndpointContract.inboundNonce(receiverAddr, originTuple.srcEid, originTuple.sender)) + 1n;
            if (BigInt(originTuple.nonce) < nextNonceBeforeCatchupTx) {
              processedMessages.add(messageId);
              pendingPackets.delete(messageId);
              continue;
            }
            const tx = await storyWallet.sendTransaction({
              to: storyEndpoint.endpointV2,
              data,
              gasLimit: 500000,
            });
            await tx.wait();

            console.log(`   ✅ Catch-up executed: ${tx.hash}`);
            processedMessages.add(messageId);
            pendingPackets.delete(messageId);
          } catch (e) {
            if (!e.message.includes("already delivered") && !e.message.includes("not verifiable")) {
              console.error(`   ⚠️  Catch-up execute error:`, e.message);
            }
          }
        }
        storyScanned += (endBlock - fromBlock + 1);
      } catch (e) {
        console.error(`   ⚠️  Catch-up scan error (blocks ${fromBlock}-${endBlock}):`, e.message);
      }
    }
    
    console.log(`   ✅ Catch-up complete: Base (${baseScanned} blocks), Story (${storyScanned} blocks), ${pendingPackets.size} pending packets\n`);
    
    // Set last blocks to current - MAX_BLOCK_RANGE so normal polling starts from recent blocks
    lastBaseBlock = Math.max(baseCurrentBlock - MAX_BLOCK_RANGE, 0);
    lastStoryBlock = Math.max(storyCurrentBlock - MAX_BLOCK_RANGE, 0);
  }

  async function watchBaseToStory() {
    try {
      const toBlock = await baseProvider.getBlockNumber();
      if (lastBaseBlock === 0) lastBaseBlock = Math.max(toBlock - MAX_BLOCK_RANGE, 0);
      const fromBlock = lastBaseBlock + 1;
      const endBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, toBlock);
      if (fromBlock > endBlock) return;

      const sentEvents = await baseEndpointContract.queryFilter(
        baseEndpointContract.filters.PacketSent(),
        fromBlock,
        endBlock
      );
      lastBaseBlock = endBlock;

      for (const ev of sentEvents) {
        const { encodedPayload } = ev.args;
        const packetHex = typeof encodedPayload === "string" ? encodedPayload : ethers.hexlify(encodedPayload);
        const packet = decodePacket(packetHex);
        if (!packet) continue;

        if (packet.dstEid !== STORY_AENEID_EID) continue;
        const receiverAddr = ethers.getAddress(packet.receiver);
        if (receiverAddr.toLowerCase() !== storyReceiver.toLowerCase()) continue;

        const senderBytes32 = ethers.zeroPadValue(ethers.getAddress(packet.sender), 32);
        const messageId = toMessageId(packet.srcEid, senderBytes32, packet.nonce);
        if (pendingPackets.has(messageId)) continue;

        pendingPackets.set(messageId, {
          origin: { srcEid: packet.srcEid, sender: packet.sender, nonce: packet.nonce },
          receiver: receiverAddr,
          guid: packet.guid,
          message: packet.message,
          extraData: "0x",
        });
        console.log(`   📦 PacketSent (poll): nonce=${packet.nonce}, guid=${packet.guid.slice(0, 10)}...`);
      }
    } catch (e) {
      console.error("   [Base→Story] Watch error:", e.message);
    }
  }

  async function executeBaseToStory() {
    try {
      const toBlock = await storyProvider.getBlockNumber();
      if (lastStoryBlock === 0) lastStoryBlock = Math.max(toBlock - MAX_BLOCK_RANGE, 0);
      const fromBlock = lastStoryBlock + 1;
      const endBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, toBlock);
      if (fromBlock > endBlock) return;

      const verifiedEvents = await storyEndpointContract.queryFilter(
        storyEndpointContract.filters.PacketVerified(),
        fromBlock,
        endBlock
      );
      lastStoryBlock = endBlock;

      for (const ev of verifiedEvents) {
        const { origin, receiver } = ev.args;
        const originTuple = { srcEid: origin.srcEid, sender: origin.sender, nonce: origin.nonce };
        const receiverHex = typeof receiver === "string" ? receiver.slice(2) : ethers.hexlify(receiver).slice(2);
        const receiverAddr = ethers.getAddress("0x" + receiverHex.slice(-40));
        if (receiverAddr.toLowerCase() !== storyReceiver.toLowerCase()) continue;

        const originSenderBytes32 = typeof origin.sender === "string" ? origin.sender : "0x" + ethers.hexlify(origin.sender).slice(2).padStart(64, "0");
        const messageId = toMessageId(origin.srcEid, originSenderBytes32, origin.nonce);
        if (processedMessages.has(messageId)) continue;

        let packet = pendingPackets.get(messageId);
        if (!packet) {
          const fetched = await fetchPacketFromBase(origin.nonce);
          if (fetched) {
            pendingPackets.set(messageId, fetched);
            packet = fetched;
            console.log(`   [Base→Story] Fetched packet for nonce=${origin.nonce} (from Base), executing...`);
          }
        }
        if (!packet) {
          console.log(`   [Base→Story] Skip nonce=${origin.nonce}: no pending packet (PacketSent not seen on Base; ensure executor was running when send tx landed)`);
          continue;
        }

        try {
          const isVerifiable = await storyEndpointContract.verifiable(originTuple, receiverAddr);
          if (!isVerifiable) continue;

          const nextNonce = (await storyEndpointContract.inboundNonce(receiverAddr, originTuple.srcEid, originTuple.sender)) + 1n;
          if (BigInt(originTuple.nonce) !== nextNonce) {
            if (BigInt(origin.nonce) < nextNonce) {
              console.log(`   [Base→Story] Skip nonce=${origin.nonce}: already delivered (endpoint next=${nextNonce})`);
            } else {
              console.log(`   [Base→Story] Skip nonce=${origin.nonce}: endpoint expects nextNonce=${nextNonce} (run scripts/skip-inbound-nonces-story.js to advance)`);
            }
            continue;
          }

          const deliveredFilter = storyEndpointContract.filters.PacketDelivered(null, null);
          const deliveredRaw = await storyEndpointContract.queryFilter(deliveredFilter, fromBlock, endBlock);
          const delivered = deliveredRaw.filter(
            (ev) =>
              ev.args.origin.srcEid === originTuple.srcEid &&
              ev.args.origin.sender === originTuple.sender &&
              ev.args.origin.nonce === originTuple.nonce &&
              String(ev.args.receiver).toLowerCase() === receiverAddr.toLowerCase()
          );
          if (delivered.length > 0) {
            processedMessages.add(messageId);
            pendingPackets.delete(messageId);
            continue;
          }

          console.log(`   [Base→Story] Executing: nonce=${origin.nonce}, guid=${packet.guid.slice(0, 10)}...`);

          const extraDataHex = packet.extraData === "0x" ? "0x" : (typeof packet.extraData === "string" ? packet.extraData : ethers.hexlify(packet.extraData));
          const data = storyEndpointSigner.interface.encodeFunctionData("lzReceive", [
            originTuple,
            receiverAddr,
            packet.guid,
            packet.message,
            extraDataHex,
          ]);
          const dataLen = data.length;
          try {
            await storyProvider.call({
              to: storyEndpoint.endpointV2,
              from: storyWallet.address,
              data,
              gasLimit: 500000,
            });
          } catch (staticErr) {
            const reason = staticErr.data || staticErr.error?.data || staticErr.message || String(staticErr);
            console.error(`   [Base→Story] Execute would revert (dataLen=${dataLen}):`, reason);
            throw staticErr;
          }
          const nextNonceBeforePollTx = (await storyEndpointContract.inboundNonce(receiverAddr, originTuple.srcEid, originTuple.sender)) + 1n;
          if (BigInt(originTuple.nonce) < nextNonceBeforePollTx) {
            processedMessages.add(messageId);
            pendingPackets.delete(messageId);
            continue;
          }
          const tx = await storyWallet.sendTransaction({
            to: storyEndpoint.endpointV2,
            data,
            gasLimit: 500000,
          });
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

  console.log("   Listening for PacketSent (Base custom endpoint) → PacketVerified (Story) → lzReceive...\n");

  // Do catch-up scan on startup
  await catchupScan();

  async function poll() {
    await watchBaseToStory();
    await executeBaseToStory();
    await tryProactiveExecute();
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  poll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
