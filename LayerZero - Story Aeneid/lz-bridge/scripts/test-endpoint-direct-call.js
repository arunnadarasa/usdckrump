/**
 * Test endpoint quote with direct call, bypassing view function caching
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  
  // Create endpoint interface manually to avoid caching
  const endpointAbi = [
    "function getSendLibrary(address _sender, uint32 _dstEid) view returns (address lib)",
    "function isDefaultSendLibrary(address _sender, uint32 _dstEid) view returns (bool)",
    "function defaultSendLibrary(uint32 _eid) view returns (address)",
    "function quote(tuple(uint32 dstEid, bytes32 receiver, bytes message, bytes options, bool payInLzToken) _params, address _sender) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee) fee)"
  ];
  
  const endpoint = new hre.ethers.Contract(ownEndpoint.endpointV2, endpointAbi, signer);
  
  console.log("🔍 Direct Endpoint Call Test");
  console.log("=".repeat(60));
  
  // Get current block
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("Current block:", blockNumber);
  
  // Try calling with explicit block
  console.log("\n1. Checking send library (block", blockNumber, ")...");
  try {
    const lib = await endpoint.getSendLibrary(baseOft.address, 1315, { blockTag: blockNumber });
    console.log("   getSendLibrary():", lib);
  } catch (e) {
    console.log("   Error:", e.message);
  }
  
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315, { blockTag: blockNumber });
  console.log("   isDefaultSendLibrary():", isDefault);
  
  const defaultLib = await endpoint.defaultSendLibrary(1315, { blockTag: blockNumber });
  console.log("   defaultSendLibrary():", defaultLib);
  
  // Since getSendLibrary returns 0 but default is set,
  // maybe the issue is that sendLibrary[oapp][eid] is set to a non-zero value
  // that's not DEFAULT_LIB but also not the library address
  
  // Let's try calling quote with the library address hardcoded in the options
  // Actually, that won't work - the endpoint needs to resolve the library itself
  
  // Let's check if maybe we need to wait more blocks
  console.log("\n2. Waiting for 3 blocks...");
  const startBlock = await hre.ethers.provider.getBlockNumber();
  let currentBlock = startBlock;
  while (currentBlock < startBlock + 3) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    currentBlock = await hre.ethers.provider.getBlockNumber();
  }
  console.log("   Now at block:", currentBlock);
  
  // Check again
  const lib2 = await endpoint.getSendLibrary(baseOft.address, 1315, { blockTag: currentBlock });
  console.log("   getSendLibrary() at block", currentBlock, ":", lib2);
  
  if (lib2 !== "0x0000000000000000000000000000000000000000") {
    console.log("   ✅ Library resolved!");
    
    // Test quote
    console.log("\n3. Testing quote...");
    const messagingParams = {
      dstEid: 1315,
      receiver: hre.ethers.zeroPadValue(signer.address, 32),
      message: "0x",
      options: "0x",
      payInLzToken: false
    };
    
    try {
      const fee = await endpoint.quote(messagingParams, baseOft.address, { blockTag: currentBlock });
      console.log("   ✅ Quote successful!");
      console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    } catch (e) {
      console.log("   ❌ Quote failed:", e.message);
    }
  } else {
    console.log("   ❌ Still returning 0");
    console.log("\n💡 This suggests a fundamental issue with getSendLibrary");
    console.log("   The storage might not be set correctly, or there's a bug");
    console.log("   in the endpoint's getSendLibrary implementation");
  }
}

main().catch(console.error);
