/**
 * Test getSendLibrary return value handling
 * The issue: Previous logs showed it returns "0" but new test shows correct address
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("Testing getSendLibrary return value...\n");

  // Test 1: Direct call (no destructuring)
  console.log("1. Direct call (no destructuring):");
  try {
    const result1 = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Type:", typeof result1);
    console.log("   Is array:", Array.isArray(result1));
    console.log("   Value:", result1);
    console.log("   Length:", result1 ? result1.length : 0);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 2: Array destructuring
  console.log("\n2. Array destructuring [lib]:");
  try {
    const [lib2] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Type:", typeof lib2);
    console.log("   Value:", lib2);
    console.log("   Is zero:", lib2 === "0" || lib2 === "0x0" || lib2 === "0x0000000000000000000000000000000000000000");
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 3: Check if it's actually a tuple return
  console.log("\n3. Checking if it returns a tuple:");
  try {
    const result3 = await endpoint.getSendLibrary.staticCall(baseOft.address, 1315);
    console.log("   Static call result:", result3);
    console.log("   Type:", typeof result3);
    console.log("   Is array:", Array.isArray(result3));
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 4: Call with block tag
  console.log("\n4. Call with explicit block tag:");
  try {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const result4 = await endpoint.getSendLibrary(baseOft.address, 1315, { blockTag: blockNumber });
    console.log("   Block:", blockNumber);
    console.log("   Value:", result4);
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test 5: Multiple calls to check consistency
  console.log("\n5. Multiple calls (check consistency):");
  for (let i = 0; i < 5; i++) {
    try {
      const result = await endpoint.getSendLibrary(baseOft.address, 1315);
      const lib = Array.isArray(result) ? result[0] : result;
      console.log(`   Call ${i + 1}: ${lib}`);
    } catch (e) {
      console.log(`   Call ${i + 1}: Error - ${e.message}`);
    }
  }

  console.log("\n✅ Tests complete");
}

main().catch(console.error);
