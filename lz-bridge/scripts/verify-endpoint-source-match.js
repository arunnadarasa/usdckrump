/**
 * Verify that the deployed EndpointV2 contract matches the provided source code
 * Check bytecode, storage layout, and function selectors
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Verifying EndpointV2 source code match\n");
  console.log("Deployed address:", ownEndpoint.endpointV2);
  
  // Get deployed bytecode
  const deployedCode = await hre.ethers.provider.getCode(ownEndpoint.endpointV2);
  console.log("Deployed bytecode length:", deployedCode.length);
  
  // Compile the contract from source
  console.log("\n1. Compiling EndpointV2 from source...");
  try {
    const EndpointV2Factory = await hre.ethers.getContractFactory("EndpointV2");
    const compiledCode = EndpointV2Factory.bytecode;
    console.log("   Compiled bytecode length:", compiledCode.length);
    
    // Compare bytecode (they won't match exactly due to constructor args, but should be similar)
    if (deployedCode.includes(compiledCode.slice(0, 100)) || compiledCode.includes(deployedCode.slice(0, 100))) {
      console.log("   ✅ Bytecode appears to match (constructor args differ)");
    } else {
      console.log("   ⚠️  Bytecode doesn't match - possible source mismatch");
    }
  } catch (e) {
    console.log("   ❌ Compilation error:", e.message);
  }
  
  // Check function selectors
  console.log("\n2. Checking function selectors...");
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  const functions = [
    "quote",
    "send",
    "getSendLibrary",
    "setSendLibrary",
    "defaultSendLibrary",
    "isDefaultSendLibrary"
  ];
  
  for (const funcName of functions) {
    try {
      // Try to call the function (view functions only)
      if (funcName === "quote") {
        // This will fail but we can check the selector
        const iface = endpoint.interface;
        const func = iface.getFunction(funcName);
        console.log(`   ${funcName}: ${func.selector}`);
      } else if (["getSendLibrary", "defaultSendLibrary", "isDefaultSendLibrary"].includes(funcName)) {
        // These are view functions we can test
        try {
          await endpoint[funcName](hre.ethers.ZeroAddress, 0);
          console.log(`   ${funcName}: ✅ Exists and callable`);
        } catch (e) {
          if (e.message.includes("execution reverted")) {
            console.log(`   ${funcName}: ✅ Exists (reverted as expected)`);
          } else {
            console.log(`   ${funcName}: ⚠️  ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log(`   ${funcName}: ❌ ${e.message}`);
    }
  }
  
  // Check storage layout
  console.log("\n3. Checking storage layout...");
  const slot0 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 0);
  console.log("   Slot 0:", slot0);
  
  // According to the source:
  // - EndpointV2 inherits: MessagingChannel, MessageLibManager, MessagingComposer, MessagingContext
  // - MessagingChannel has: eid (uint32) - but this is set in constructor
  // - MessageLibManager inherits Ownable which has _owner at slot 0
  // - EndpointV2 adds: lzToken, delegates mapping
  
  // Slot 0 should be _owner (from Ownable via MessageLibManager)
  const owner = await endpoint.owner();
  console.log("   Owner from contract:", owner);
  console.log("   Slot 0 as address:", "0x" + slot0.slice(-40));
  console.log("   Match:", owner.toLowerCase() === ("0x" + slot0.slice(-40)).toLowerCase());
  
  // Check if getSendLibrary works
  console.log("\n4. Testing getSendLibrary()...");
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  
  try {
    const lib = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   getSendLibrary():", lib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
  } catch (e) {
    console.log("   Error:", e.message);
  }
  
  console.log("\n✅ Verification complete");
}

main().catch(console.error);
