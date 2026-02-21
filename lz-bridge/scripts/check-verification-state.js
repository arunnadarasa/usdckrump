/**
 * Check ReceiveUln302.hashLookup for a packet (from PacketSent event).
 * Run: node scripts/check-verification-state.js
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const PACKET_HEADER_LENGTH = 81;
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

  const endpointAbi = ["event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)"];
  const baseEp = new ethers.Contract(baseDeploy.endpointV2, endpointAbi, baseProvider);
  const toBlock = await baseProvider.getBlockNumber();
  const fromBlock = Math.max(0, toBlock - 9); // 10 blocks total (inclusive)
  const events = await baseEp.queryFilter(baseEp.filters.PacketSent(), fromBlock, toBlock);
  const storyReceiver = ethers.getAddress(storyOapp.oappProxyOft);
  const verifierDvn = storyDeploy.verifierDVN;

  const recvAbi = [
    "function hashLookup(bytes32, bytes32, address) view returns (bool submitted, uint64 confirmations)",
    "function getUlnConfig(address, uint32) view returns (tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs))",
  ];
  const receiveUln = new ethers.Contract(storyDeploy.receiveUln302, recvAbi, storyProvider);

  for (const ev of events) {
    const { encodedPayload } = ev.args;
    const built = buildHeaderAndPayloadHash(encodedPayload);
    if (!built) continue;
    const hex = typeof encodedPayload === "string" ? encodedPayload.slice(2) : ethers.hexlify(encodedPayload).slice(2);
    const dstEid = parseInt(hex.slice(90, 98), 16);
    const receiver = "0x" + hex.slice(98, 162).slice(-40);
    if (dstEid !== STORY_AENEID_EID || ethers.getAddress(receiver).toLowerCase() !== storyReceiver.toLowerCase()) continue;
    const nonce = BigInt("0x" + hex.slice(2, 18));
    const lookup = await receiveUln.hashLookup(built.headerHash, built.payloadHash, verifierDvn);
    const config = await receiveUln.getUlnConfig(ethers.getAddress(receiver), BASE_SEPOLIA_EID);
    console.log("Packet nonce:", nonce.toString());
    console.log("  headerHash:", built.headerHash);
    console.log("  payloadHash:", built.payloadHash);
    console.log("  hashLookup(VerifierDVN):", lookup);
    console.log("  requiredDVNs:", config.requiredDVNs);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
