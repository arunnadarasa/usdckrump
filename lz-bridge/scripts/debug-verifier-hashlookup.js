/**
 * Debug LZ_ULN_Verifying: submit one verification, check hashLookup, then try commit.
 * Run: LZ_VERIFIER_KEY=0x... node scripts/debug-verifier-hashlookup.js
 * Run this shortly after a test send (npm run test:proxy-oft -- baseSepolia) so a packet
 * exists in the last 50 blocks. Uses 10-block chunks for Base RPC.
 *
 * IMPORTANT: Stop the verifier worker (npm run lz-verifier:oapp-proxy) before running
 * this script. Otherwise both may try to commit the same packet; the first commit
 * clears hashLookup, so the second reverts with LZ_ULN_Verifying (race condition).
 *
 * Steps: 1) submitVerification only  2) Read hashLookup  3) Try commitVerification
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const PACKET_HEADER_LENGTH = 81;
const MAX_BLOCK_RANGE = 10;
const CATCHUP_BLOCKS = 50;
const BASE_SEPOLIA_EID = 40245;
const STORY_AENEID_EID = 1315;

function buildHeaderAndPayloadHash(encodedPayload) {
  const hex = typeof encodedPayload === "string"
    ? encodedPayload.startsWith("0x") ? encodedPayload.slice(2) : encodedPayload
    : ethers.hexlify(encodedPayload).slice(2);
  if (hex.length < PACKET_HEADER_LENGTH * 2) return null;
  const headerHex = hex.slice(0, PACKET_HEADER_LENGTH * 2);
  const payloadHex = hex.slice(PACKET_HEADER_LENGTH * 2);
  const packetHeader = "0x" + headerHex;
  const payloadHash = ethers.keccak256("0x" + payloadHex);
  const headerHash = ethers.keccak256(packetHeader);
  return { packetHeader, payloadHash, headerHash };
}

async function main() {
  const baseDeploy = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const storyDeploy = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const storyOapp = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8"));

  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY";
  const storyRpc = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";
  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const storyProvider = new ethers.JsonRpcProvider(storyRpc);

  const storyReceiver = ethers.getAddress(storyOapp.oappProxyOft);
  const verifierDvnAddress = storyDeploy.verifierDVN;

  const endpointAbi = ["event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)"];
  const baseEp = new ethers.Contract(baseDeploy.endpointV2, endpointAbi, baseProvider);

  let latestPacket = null;
  const toBlock = await baseProvider.getBlockNumber();
  for (let from = Math.max(0, toBlock - CATCHUP_BLOCKS); from < toBlock; from += MAX_BLOCK_RANGE) {
    const to = Math.min(from + MAX_BLOCK_RANGE - 1, toBlock);
    const events = await baseEp.queryFilter(baseEp.filters.PacketSent(), from, to);
    for (const ev of events) {
      const { encodedPayload } = ev.args;
      const built = buildHeaderAndPayloadHash(encodedPayload);
      if (!built) continue;
      const hex = typeof encodedPayload === "string" ? encodedPayload.slice(2) : ethers.hexlify(encodedPayload).slice(2);
      const dstEid = parseInt(hex.slice(90, 98), 16);
      const receiver = "0x" + hex.slice(98, 162).slice(-40);
      if (dstEid !== STORY_AENEID_EID || ethers.getAddress(receiver).toLowerCase() !== storyReceiver.toLowerCase()) continue;
      const nonce = BigInt("0x" + hex.slice(2, 18));
      if (!latestPacket || nonce > latestPacket.nonce) latestPacket = { ev, encodedPayload, built, hex, nonce };
    }
  }

  if (!latestPacket) {
    console.log("No PacketSent to Story OApp in last", CATCHUP_BLOCKS, "blocks.");
    return;
  }

  const { built, nonce } = latestPacket;
  console.log("Latest packet to Story OApp: nonce =", nonce.toString());
  console.log("  headerHash:", built.headerHash);
  console.log("  payloadHash:", built.payloadHash);

  const recvAbi = [
    "function hashLookup(bytes32, bytes32, address) view returns (bool submitted, uint64 confirmations)",
    "function commitVerification(bytes calldata _packetHeader, bytes32 _payloadHash) external",
    "function getUlnConfig(address _oapp, uint32 _remoteEid) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
    "function verifiable(tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs) _config, bytes32 _headerHash, bytes32 _payloadHash) view returns (bool)",
  ];
  const receiveUln = new ethers.Contract(storyDeploy.receiveUln302, recvAbi, storyProvider);
  const verifierDvnAbi = [
    "function submitVerification(bytes calldata _packetHeader, bytes32 _payloadHash, uint64 _confirmations) external",
    "function submitAndCommit(bytes calldata _packetHeader, bytes32 _payloadHash, uint64 _confirmations) external",
  ];
  const verifierDvn = new ethers.Contract(verifierDvnAddress, verifierDvnAbi, storyProvider);

  const receiverFromHeader = ethers.getAddress("0x" + latestPacket.hex.slice(98, 162).slice(-40));
  const srcEidFromHeader = parseInt(latestPacket.hex.slice(18, 26), 16);
  console.log("  receiver (from header):", receiverFromHeader);
  console.log("  srcEid (from header):", srcEidFromHeader);

  // Extract receiver/srcEid from built.packetHeader (same way contract does in commitVerification)
  const packetHeaderHex = built.packetHeader.startsWith("0x") ? built.packetHeader.slice(2) : built.packetHeader;
  const SRC_EID_OFFSET = 9;
  const SENDER_OFFSET = 13;
  const RECEIVER_OFFSET = 49;
  const GUID_OFFSET = 81;
  const srcEidFromPacketHeader = parseInt(packetHeaderHex.slice(SRC_EID_OFFSET * 2, SENDER_OFFSET * 2), 16);
  const receiverHex = packetHeaderHex.slice(RECEIVER_OFFSET * 2, GUID_OFFSET * 2);
  const receiverFromPacketHeader = ethers.getAddress("0x" + receiverHex.slice(-40));
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-verifier-hashlookup.js:extract',message:'receiver/srcEid extraction comparison',data:{receiverFromHeader,receiverFromPacketHeader,srcEidFromHeader,srcEidFromPacketHeader,receiverMatch:receiverFromHeader.toLowerCase()===receiverFromPacketHeader.toLowerCase(),srcEidMatch:srcEidFromHeader===srcEidFromPacketHeader},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const config = await receiveUln.getUlnConfig(receiverFromHeader, BASE_SEPOLIA_EID);
  const configPlain = { confirmations: config.confirmations, requiredDVNCount: config.requiredDVNCount, optionalDVNCount: config.optionalDVNCount, optionalDVNThreshold: config.optionalDVNThreshold, requiredDVNs: [...(config.requiredDVNs || [])], optionalDVNs: [...(config.optionalDVNs || [])] };
  const canCommitView = await receiveUln.verifiable(configPlain, built.headerHash, built.payloadHash);
  console.log("  verifiable(config, headerHash, payloadHash):", canCommitView);
  console.log("  requiredDVNs:", (config.requiredDVNs || []).map(a => a.toString()));
  
  // Also try with receiverFromPacketHeader to see if that's the issue
  const configFromPacketHeader = await receiveUln.getUlnConfig(receiverFromPacketHeader, srcEidFromPacketHeader);
  const configPlainFromPacketHeader = { confirmations: configFromPacketHeader.confirmations, requiredDVNCount: configFromPacketHeader.requiredDVNCount, optionalDVNCount: configFromPacketHeader.optionalDVNCount, optionalDVNThreshold: configFromPacketHeader.optionalDVNThreshold, requiredDVNs: [...(configFromPacketHeader.requiredDVNs || [])], optionalDVNs: [...(configFromPacketHeader.optionalDVNs || [])] };
  const canCommitViewFromPacketHeader = await receiveUln.verifiable(configPlainFromPacketHeader, built.headerHash, built.payloadHash);
  // #region agent log
  const configConfirmations = configFromPacketHeader.confirmations != null ? String(configFromPacketHeader.confirmations) : null;
  fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-verifier-hashlookup.js:verifiable',message:'verifiable with different configs',data:{canCommitView,canCommitViewFromPacketHeader,receiverFromHeader,receiverFromPacketHeader,srcEidFromHeader,srcEidFromPacketHeader,configConfirmations},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // #region agent log
  const requiredDVN0 = (config.requiredDVNs && config.requiredDVNs[0]) ? config.requiredDVNs[0].toString() : null;
  const addressesMatch = requiredDVN0 && ethers.getAddress(requiredDVN0) === ethers.getAddress(verifierDvnAddress);
  fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-verifier-hashlookup.js:config',message:'config and address match',data:{receiverFromHeader,srcEidFromHeader,requiredDVN0,verifierDvnAddress,addressesMatch,canCommitView},hypothesisId:'C',timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const lookupBefore = await receiveUln.hashLookup(built.headerHash, built.payloadHash, verifierDvnAddress);
  console.log("  hashLookup(VerifierDVN) BEFORE submit:", lookupBefore);

  const key = process.env.LZ_VERIFIER_KEY || process.env.PRIVATE_KEY;
  if (!key) {
    console.log("\nSet LZ_VERIFIER_KEY to run submitAndCommit.");
    return;
  }

  const wallet = new ethers.Wallet(key, storyProvider);
  const verifierDvnSigner = new ethers.Contract(verifierDvnAddress, verifierDvnAbi, wallet);
  const receiveUlnSigner = new ethers.Contract(storyDeploy.receiveUln302, recvAbi, wallet);

  // Use config from packet header; pass at least 1 so we satisfy default ULN config when view returns 0 but runtime uses 1
  const configConfirmationsNum = configFromPacketHeader.confirmations != null ? Number(configFromPacketHeader.confirmations) : 0;
  const confirmationsToSubmit = Math.max(1, configConfirmationsNum);
  const feeData = await storyProvider.getFeeData();
  const gasOpts = {
    maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n / 100n) : undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 120n / 100n) : undefined,
    gasLimit: 400000, // skip estimateGas (simulation was reverting with LZ_ULN_Verifying; real execution may succeed)
  };
  const gasOptsFiltered = Object.fromEntries(Object.entries(gasOpts).filter(([, v]) => v != null));

  // Default config (address(0), srcEid) is what commit uses when OApp has no custom config
  const defaultConfig = await receiveUln.getUlnConfig(ethers.ZeroAddress, srcEidFromPacketHeader);
  const defaultRequiredDVN0 = (defaultConfig.requiredDVNs && defaultConfig.requiredDVNs[0]) ? defaultConfig.requiredDVNs[0].toString() : null;
  const defaultMatchesVerifier = defaultRequiredDVN0 && ethers.getAddress(defaultRequiredDVN0) === ethers.getAddress(verifierDvnAddress);
  console.log("  default ULN config (address(0), srcEid): confirmations=" + (defaultConfig.confirmations != null ? String(defaultConfig.confirmations) : "?") + " requiredDVN[0]=" + defaultRequiredDVN0 + " matchesVerifier=" + defaultMatchesVerifier);

  // Single tx: verify + commit (submitAndCommit) so no race and contract sees same state for both steps
  console.log("\n1. Calling VerifierDVN.submitAndCommit(..., confirmations=" + confirmationsToSubmit + ")...");
  let tx1;
  try {
    tx1 = await verifierDvnSigner.submitAndCommit(built.packetHeader, built.payloadHash, confirmationsToSubmit, gasOptsFiltered);
  } catch (e) {
    if (e.code === "REPLACEMENT_UNDERPRICED" || (e.message && e.message.includes("replacement fee"))) {
      console.error("   A pending tx from this wallet is already in the mempool. Wait for it to confirm, or stop the verifier worker, then re-run.");
    }
    const revertData = e.data || (e.info && e.info.error && e.info.error.data);
    const is78e84d06 = revertData && String(revertData).slice(0, 10) === "0x78e84d06";
    console.error("   submitAndCommit failed. revertData:", revertData ? String(revertData).slice(0, 20) : "none");
    if (is78e84d06) console.error("   0x78e84d06 = LZ_DefaultReceiveLibUnavailable (endpoint has no receive lib for OApp/srcEid). Fix: npx hardhat run scripts/configure-oapp-proxy-oft-story.js --network storyAeneid");
    fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-verifier-hashlookup.js:submitAndCommitFail',message:'submitAndCommit reverted',data:{revertData:revertData?String(revertData).slice(0,14):null,isDefaultReceiveLibUnavailable:is78e84d06,defaultRequiredDVN0,defaultMatchesVerifier,confirmationsToSubmit},timestamp:Date.now()})}).catch(()=>{});
    throw e;
  }
  await tx1.wait();
  console.log("   Tx:", tx1.hash, "- OK (verify + commit in one tx)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
