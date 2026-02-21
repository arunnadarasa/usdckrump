/**
 * Test peer directly and trace the exact failure point
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🔍 Testing Peer Directly");
  console.log("=".repeat(60));
  
  // Check peer
  const peer = await oft.peers(1315);
  const expectedPeer = hre.ethers.zeroPadValue(storyOft.address, 32);
  
  console.log("Peer:", peer);
  console.log("Expected:", expectedPeer);
  console.log("Match:", peer.toLowerCase() === expectedPeer.toLowerCase() ? "✅" : "❌");
  console.log("Is zero:", peer === "0x0000000000000000000000000000000000000000000000000000000000000000" ? "❌" : "✅\n");
  
  if (peer === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("❌ Peer is not set! This would cause NoPeer error.");
    console.log("   Need to run: npx hardhat run scripts/link-oft-krump.js");
    return;
  }
  
  // Try calling _getPeerOrRevert equivalent by calling quoteSend
  // But first, let's check what error selector 0x71c4efed actually is
  console.log("📋 Error Analysis:");
  const errorSelector = "0x71c4efed";
  console.log("   Error selector:", errorSelector);
  
  // Calculate selectors for various errors
  const errors = [
    "NoPeer(uint32)",
    "OnlyPeer(uint32,bytes32)",
    "LZ_DefaultSendLibUnavailable()",
    "LZ_UnsupportedEid()",
    "SlippageExceeded(uint256,uint256)"
  ];
  
  console.log("\n   Calculated selectors:");
  for (const errorSig of errors) {
    const selector = hre.ethers.id(errorSig).slice(0, 10);
    const match = selector.toLowerCase() === errorSelector.toLowerCase() ? "✅ MATCH" : "";
    console.log(`   ${errorSig}: ${selector} ${match}`);
  }
  
  // The error data has 0x186a0 at the end which is 100000
  // Let's see if that's relevant
  const errorData = "0x71c4efed000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000186a0";
  const param = errorData.slice(-64);
  const paramValue = BigInt(param);
  console.log("\n   Error parameter (last 32 bytes):", param);
  console.log("   As uint256:", paramValue.toString());
  console.log("   As hex:", "0x" + paramValue.toString(16));
  console.log("   Expected EID: 1315 (0x523)");
  console.log("   Match:", paramValue === 1315n ? "✅" : "❌");
  
  // Try to decode as different error types
  console.log("\n📝 Attempting to decode error...");
  const errorInterface = new hre.ethers.Interface([
    `error CustomError(uint256 value)`,
    `error CustomError2(uint256 a, uint256 b)`,
  ]);
  
  // Since we can't match the selector, maybe it's a custom error from SendUln302
  // Let's check SendUln302 for custom errors
  console.log("\n💡 The error might be from SendUln302 when it tries to quote");
  console.log("   Let's check if SendUln302 needs additional configuration");
}

main().catch(console.error);
