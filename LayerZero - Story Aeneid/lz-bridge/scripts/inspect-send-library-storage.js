/**
 * Inspect send library storage directly using storage slots
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Inspecting Send Library Storage");
  console.log("=".repeat(60));
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // In MessageLibManager, sendLibrary is:
  // mapping(address sender => mapping(uint32 dstEid => address lib)) internal sendLibrary;
  
  // Storage slot calculation for nested mappings:
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot_number)), key2))
  
  // First, we need to find the storage slot for sendLibrary mapping
  // Since it's internal, we can't access it directly, but we can use the public getter
  // or try to calculate the storage slot
  
  // Let's try a different approach - check what the OFT's endpoint() returns
  console.log("1. Checking OFT's endpoint...");
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const oftEndpoint = await oft.endpoint();
  console.log("   OFT endpoint:", oftEndpoint);
  console.log("   Expected:", ownEndpoint.endpointV2);
  console.log("   Match:", oftEndpoint.toLowerCase() === ownEndpoint.endpointV2.toLowerCase() ? "✅" : "❌\n");

  // Check if OFT has peer set
  console.log("2. Checking OFT peer...");
  const peer = await oft.peers(1315);
  console.log("   Peer:", peer);
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  const expectedPeer = hre.ethers.zeroPadValue(storyOft.address, 32);
  console.log("   Expected:", expectedPeer);
  console.log("   Match:", peer.toLowerCase() === expectedPeer.toLowerCase() ? "✅" : "❌\n");

  // Try to call quoteSend and see where it fails
  console.log("3. Testing quoteSend call flow...");
  const [signer] = await hre.ethers.getSigners();
  
  const sendParam = {
    dstEid: 1315,
    to: hre.ethers.zeroPadValue(signer.address, 32),
    amountLD: hre.ethers.parseUnits("0.1", 6),
    minAmountLD: hre.ethers.parseUnits("0.1", 6),
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  // Check what OFTCore does - it calls endpoint.quote()
  // Let's trace through the call
  console.log("   Calling oft.quoteSend()...");
  try {
    // This will call OFTCore.quoteSend() which calls endpoint.quote()
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend successful!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
  } catch (e) {
    console.log("   ❌ quoteSend failed");
    console.log("   Error:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      console.log("   Selector:", e.data.slice(0, 10));
      
      // Try to decode as various errors
      const errors = [
        "error NoPeer(uint32 eid)",
        "error LZ_DefaultSendLibUnavailable()",
        "error LZ_UnsupportedEid()",
        "error InvalidEndpointCall()"
      ];
      
      for (const errorSig of errors) {
        try {
          const iface = new hre.ethers.Interface([errorSig]);
          const decoded = iface.parseError(e.data);
          console.log(`   ✅ Decoded as: ${decoded.name}`);
          if (decoded.args) console.log("   Args:", decoded.args);
          break;
        } catch {}
      }
    }
    
    // Check if it's a revert from OFTCore or Endpoint
    console.log("\n   Checking endpoint quote directly...");
    try {
      const messagingParams = {
        dstEid: 1315,
        receiver: hre.ethers.zeroPadValue(signer.address, 32),
        message: "0x",
        options: "0x",
        payInLzToken: false
      };
      const fee = await endpoint.quote(messagingParams, baseOft.address);
      console.log("   ✅ Endpoint quote works!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("\n   💡 Issue might be in OFTCore, not endpoint!");
    } catch (e2) {
      console.log("   ❌ Endpoint quote also fails:", e2.message);
      if (e2.data) console.log("   Error data:", e2.data);
    }
  }
}

main().catch(console.error);
