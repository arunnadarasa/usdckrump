/**
 * Test quote by calling SendUln302 directly, bypassing endpoint.getSendLibrary
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  console.log("🧪 Testing Direct Library Call");
  console.log("=".repeat(60));
  
  // Since getSendLibrary returns 0 but LZ_SameValue says it's set,
  // maybe there's a view function caching issue
  // Let's try calling quote directly on SendUln302
  
  console.log("1. Testing SendUln302.quote() directly...");
  
  // SendUln302.quote needs a Packet
  // But actually, the endpoint should handle this
  
  // Let's try a different approach - check if maybe the issue is
  // that we need to wait for a block or there's some state inconsistency
  
  // Actually, let me check if maybe the OFT is calling a different endpoint
  // or if there's some other issue
  
  console.log("2. Checking OFT endpoint...");
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const oftEndpoint = await oft.endpoint();
  console.log("   OFT endpoint:", oftEndpoint);
  console.log("   Our endpoint:", ownEndpoint.endpointV2);
  console.log("   Match:", oftEndpoint.toLowerCase() === ownEndpoint.endpointV2.toLowerCase() ? "✅" : "❌\n");
  
  if (oftEndpoint.toLowerCase() !== ownEndpoint.endpointV2.toLowerCase()) {
    console.log("❌ OFT is using a different endpoint!");
    return;
  }
  
  // Since LZ_SameValue confirms the library IS set, but getSendLibrary returns 0,
  // maybe the issue is in how getSendLibrary resolves the value
  // Let's try calling quoteSend on the OFT but with a workaround
  
  console.log("3. Testing OFT.quoteSend() with current state...");
  const sendParam = {
    dstEid: 1315,
    to: hre.ethers.zeroPadValue(signer.address, 32),
    amountLD: hre.ethers.parseUnits("0.1", 6),
    minAmountLD: hre.ethers.parseUnits("0.1", 6),
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };
  
  try {
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend successful!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
    
    // If quote works, try send
    console.log("\n4. Testing OFT.send()...");
    const fee = {
      nativeFee,
      lzTokenFee
    };
    
    const tx = await oft.send(sendParam, fee, signer.address, { value: nativeFee });
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Send successful!");
    console.log("   Block:", receipt.blockNumber);
    
  } catch (e) {
    console.log("   ❌ quoteSend failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      console.log("   Selector:", e.data.slice(0, 10));
      
      // The error 0x71c4efed - let's try to understand it
      // Maybe it's from OFTCore checking peers?
      console.log("\n5. Checking if error is from peer check...");
      const peer = await oft.peers(1315);
      const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
      const expectedPeer = hre.ethers.zeroPadValue(storyOft.address, 32);
      console.log("   Peer:", peer);
      console.log("   Expected:", expectedPeer);
      console.log("   Match:", peer.toLowerCase() === expectedPeer.toLowerCase() ? "✅" : "❌");
      
      // Check if error selector matches NoPeer
      const noPeerSelector = hre.ethers.id("NoPeer(uint32)").slice(0, 10);
      const errorSelector = e.data.slice(0, 10);
      console.log("   Error selector:", errorSelector);
      console.log("   NoPeer selector:", noPeerSelector);
      console.log("   Match:", errorSelector.toLowerCase() === noPeerSelector.toLowerCase() ? "✅" : "❌");
    }
  }
}

main().catch(console.error);
