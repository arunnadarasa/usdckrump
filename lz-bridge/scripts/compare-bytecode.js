/**
 * Compare deployed bytecode with locally compiled bytecode
 * This helps verify if there's a compilation/deployment mismatch
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Comparing Deployed vs Compiled Bytecode\n");
  console.log("Deployed EndpointV2:", ownEndpoint.endpointV2);
  
  // Get deployed bytecode (runtime bytecode, without constructor)
  const deployedCode = await hre.ethers.provider.getCode(ownEndpoint.endpointV2);
  console.log("Deployed bytecode length:", deployedCode.length);
  console.log("Deployed bytecode (first 100 chars):", deployedCode.slice(0, 100));
  
  // Get locally compiled bytecode
  try {
    const EndpointV2Factory = await hre.ethers.getContractFactory("EndpointV2");
    const compiledBytecode = EndpointV2Factory.bytecode;
    console.log("\nCompiled bytecode length:", compiledBytecode.length);
    console.log("Compiled bytecode (first 100 chars):", compiledBytecode.slice(0, 100));
    
    // Note: They won't match exactly because:
    // 1. Constructor args are different
    // 2. But runtime bytecode should be similar
    
    // Try to find the getSendLibrary function selector in both
    const getSendLibrarySelector = "0x" + hre.ethers.id("getSendLibrary(address,uint32)").slice(0, 10);
    console.log("\ngetSendLibrary selector:", getSendLibrarySelector);
    
    const deployedHasSelector = deployedCode.includes(getSendLibrarySelector.slice(2));
    const compiledHasSelector = compiledBytecode.includes(getSendLibrarySelector.slice(2));
    
    console.log("Deployed bytecode contains selector:", deployedHasSelector);
    console.log("Compiled bytecode contains selector:", compiledHasSelector);
    
    if (deployedHasSelector && compiledHasSelector) {
      console.log("\n✅ Both bytecodes contain getSendLibrary function");
      console.log("   This suggests the function exists in both");
      console.log("   The bug is likely in how it executes, not missing code");
    } else {
      console.log("\n⚠️  Selector mismatch detected");
      console.log("   This might indicate a compilation/deployment issue");
    }
    
    // Check quote function selector
    const quoteSelector = "0x" + hre.ethers.id("quote((uint32,bytes32,bytes,bytes,bool),address)").slice(0, 10);
    console.log("\nquote selector:", quoteSelector);
    
    const deployedHasQuote = deployedCode.includes(quoteSelector.slice(2));
    const compiledHasQuote = compiledBytecode.includes(quoteSelector.slice(2));
    
    console.log("Deployed bytecode contains quote:", deployedHasQuote);
    console.log("Compiled bytecode contains quote:", compiledHasQuote);
    
  } catch (e) {
    console.error("Error comparing bytecode:", e.message);
  }
  
  console.log("\n✅ Comparison complete");
  console.log("\n💡 Next steps:");
  console.log("   1. If selectors match, the issue is in execution, not deployment");
  console.log("   2. Try redeploying with different compiler settings");
  console.log("   3. See REDEPLOY_INSTRUCTIONS.md for details");
}

main().catch(console.error);
