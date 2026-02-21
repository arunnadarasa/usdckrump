/**
 * One-time script: advance Story endpoint inbound nonce so the executor can deliver
 * messages that were verified out of order (e.g. we have nonce 34 but endpoint expects 1).
 *
 * Calls endpoint.skip(oapp, 40245, sender, k) for k = 1, 2, ... upToNonce-1.
 * Requires: signer must be the Story OApp (OAppProxyOFT) or the endpoint delegate for that OApp.
 *
 * Usage (from lz-bridge):
 *   LZ_EXECUTOR_KEY=<key> node scripts/skip-inbound-nonces-story.js [upToNonce]
 *   Default upToNonce = 34 (skips 1..33 so next expected is 34).
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

const BASE_SEPOLIA_EID = 40245;

const ENDPOINT_ABI = [
  "function skip(address _oapp, uint32 _srcEid, bytes32 _sender, uint64 _nonce) external",
  "function inboundNonce(address _receiver, uint32 _srcEid, bytes32 _sender) view returns (uint64)",
];

async function main() {
  const storyEndpointPath = "deployments/story-aeneid-latest.json";
  const storyOappPath = "deployments/oapp-proxy-oft-storyAeneid-latest.json";
  const baseOappPath = "deployments/oapp-proxy-oft-baseSepolia-latest.json";

  if (!fs.existsSync(storyEndpointPath) || !fs.existsSync(storyOappPath) || !fs.existsSync(baseOappPath)) {
    console.error("❌ Missing deployment files (story-aeneid-latest.json, oapp-proxy-oft-*-latest.json)");
    process.exit(1);
  }

  const storyEndpoint = JSON.parse(fs.readFileSync(storyEndpointPath, "utf8"));
  const storyOapp = JSON.parse(fs.readFileSync(storyOappPath, "utf8"));
  const baseOapp = JSON.parse(fs.readFileSync(baseOappPath, "utf8"));

  const storyRpc = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";
  const provider = new ethers.JsonRpcProvider(storyRpc);
  const key = process.env.LZ_EXECUTOR_KEY || process.env.PRIVATE_KEY;
  if (!key) {
    console.error("❌ Set LZ_EXECUTOR_KEY or PRIVATE_KEY");
    process.exit(1);
  }
  const wallet = new ethers.Wallet(key, provider);

  const oapp = ethers.getAddress(storyOapp.oappProxyOft);
  const senderBytes32 = ethers.zeroPadValue(ethers.getAddress(baseOapp.oappProxyOft), 32);
  const endpoint = new ethers.Contract(storyEndpoint.endpointV2, ENDPOINT_ABI, wallet);

  const upToNonce = Math.max(1, parseInt(process.argv[2] || "34", 10));
  let current = await endpoint.inboundNonce(oapp, BASE_SEPOLIA_EID, senderBytes32);
  console.log("Story endpoint inbound nonce (Base→OApp):", current.toString(), "→ will advance to", upToNonce - 1);

  if (current >= BigInt(upToNonce - 1)) {
    console.log("✅ No skip needed; next expected nonce is already", current + 1n);
    return;
  }

  for (let k = Number(current) + 1; k < upToNonce; k++) {
    try {
      const tx = await endpoint.skip(oapp, BASE_SEPOLIA_EID, senderBytes32, BigInt(k));
      await tx.wait();
      console.log("   Skip nonce", k, "tx:", tx.hash);
    } catch (e) {
      const data = e.data || e.info?.error?.data || "";
      if (typeof data === "string" && data.slice(0, 10) === "0xc09b6350") {
        const currentNow = await endpoint.inboundNonce(oapp, BASE_SEPOLIA_EID, senderBytes32);
        console.error("❌ LZ_InvalidNonce: skip failed at nonce", k, "(current inbound nonce is now", currentNow.toString() + "). Re-run the script to continue from here.");
      } else if (typeof data === "string" && data.slice(0, 10) === "0x1e8a6952") {
        console.error("❌ LZ_Unauthorized: signer must be the Story OApp or the endpoint delegate.");
      } else {
        console.error("❌ Error:", e.shortMessage || e.message);
      }
      throw e;
    }
  }

  const after = await endpoint.inboundNonce(oapp, BASE_SEPOLIA_EID, senderBytes32);
  console.log("✅ Done. Next expected nonce is now", after + 1n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
