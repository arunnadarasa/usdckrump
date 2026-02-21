/**
 * Test send library caching issue
 * Checks if getSendLibrary() resolves correctly after waiting for blocks
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🧪 Testing Send Library Caching");
  console.log("=".repeat(60));
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // Get current block
  let currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);

  // Test 1: Check without block tag (may use cached value)
  console.log("\n1. Testing without block tag (may use cache)...");
  try {
    const [lib1] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefault1 = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    const defaultLib1 = await endpoint.defaultSendLibrary(1315);
    
    console.log("   getSendLibrary():", lib1);
    console.log("   isDefaultSendLibrary():", isDefault1);
    console.log("   defaultSendLibrary():", defaultLib1);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib1.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (lib1 === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  Still returning 0 - caching issue persists");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test 2: Check with explicit block tag (should bypass cache)
  console.log("\n2. Testing with explicit block tag (bypasses cache)...");
  try {
    const [lib2] = await endpoint.getSendLibrary(baseOft.address, 1315, { blockTag: currentBlock });
    const isDefault2 = await endpoint.isDefaultSendLibrary(baseOft.address, 1315, { blockTag: currentBlock });
    const defaultLib2 = await endpoint.defaultSendLibrary(1315, { blockTag: currentBlock });
    
    console.log("   getSendLibrary() (block", currentBlock, "):", lib2);
    console.log("   isDefaultSendLibrary():", isDefault2);
    console.log("   defaultSendLibrary():", defaultLib2);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib2.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test 3: Wait for a few blocks and check again
  console.log("\n3. Waiting for 5 blocks and checking again...");
  const startBlock = currentBlock;
  let waitedBlocks = 0;
  
  while (waitedBlocks < 5) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBlock = await hre.ethers.provider.getBlockNumber();
    if (newBlock > currentBlock) {
      waitedBlocks += (newBlock - currentBlock);
      currentBlock = newBlock;
      console.log(`   Block ${currentBlock} (waited ${waitedBlocks} blocks)`);
    }
  }
  
  console.log("\n4. Testing after waiting (block", currentBlock, ")...");
  try {
    const [lib3] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefault3 = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    
    console.log("   getSendLibrary():", lib3);
    console.log("   isDefaultSendLibrary():", isDefault3);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib3.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (lib3.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n   ✅ Caching issue resolved! Library resolves correctly.");
    } else if (lib3 === "0x0000000000000000000000000000000000000000") {
      console.log("\n   ❌ Caching issue persists - still returning 0");
    }
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test 4: Try quoteSend to see if it works now
  console.log("\n5. Testing quoteSend (actual usage)...");
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
    
    console.log("\n🎉 Send library is working correctly!");
    console.log("   The caching issue appears to be resolved.");
    
  } catch (e) {
    console.log("   ❌ quoteSend failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      console.log("   Selector:", e.data.slice(0, 10));
      
      if (e.data.slice(0, 10).toLowerCase() === "0x6592671c") {
        console.log("\n   💡 Error: LZ_DefaultSendLibUnavailable");
        console.log("   This suggests getSendLibrary is still returning 0 during execution");
        console.log("   The view function cache may not affect actual transaction execution");
      } else if (e.data.slice(0, 10).toLowerCase() === "0x71c4efed") {
        console.log("\n   💡 Error: SlippageExceeded");
        console.log("   This suggests a different issue - check decimals configuration");
      }
    }
  }
}

main().catch(console.error);
