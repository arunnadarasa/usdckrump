/**
 * Check if sendLibrary[_sender][_dstEid] is set to address(0) instead of DEFAULT_LIB
 * If it's address(0) (not DEFAULT_LIB), getSendLibrary() would return it without checking default
 * But externally it works, so maybe internally it's different?
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Checking sendLibrary Mapping\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;
  const DEFAULT_LIB = "0x0000000000000000000000000000000000000000";

  // Check sendLibrary mapping directly via storage
  console.log("1. Checking sendLibrary mapping via getSendLibrary():");
  const lib = await endpoint.getSendLibrary(testSender, dstEid);
  console.log("   getSendLibrary():", lib);
  console.log("   Is DEFAULT_LIB:", lib === DEFAULT_LIB ? "✅" : "❌");
  console.log("   Is zero address:", lib === "0x0000000000000000000000000000000000000000" ? "✅" : "❌");

  // Check isDefaultSendLibrary
  console.log("\n2. Checking isDefaultSendLibrary():");
  const isDefault = await endpoint.isDefaultSendLibrary(testSender, dstEid);
  console.log("   isDefaultSendLibrary():", isDefault);
  console.log("   This means sendLibrary[_sender][_dstEid] == DEFAULT_LIB:", isDefault ? "✅" : "❌");

  // Check defaultSendLibrary
  console.log("\n3. Checking defaultSendLibrary():");
  const defaultLib = await endpoint.defaultSendLibrary(dstEid);
  console.log("   defaultSendLibrary(1315):", defaultLib);
  console.log("   Is zero:", defaultLib === "0x0000000000000000000000000000000000000000" ? "❌" : "✅");

  // Logic check
  console.log("\n4. Logic analysis:");
  if (isDefault) {
    console.log("   sendLibrary[_sender][_dstEid] == DEFAULT_LIB");
    console.log("   So getSendLibrary() checks defaultSendLibrary[_dstEid]");
    console.log("   defaultSendLibrary[1315] =", defaultLib);
    if (defaultLib === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ This would cause LZ_DefaultSendLibUnavailable()!");
      console.log("   But externally getSendLibrary() returns:", lib);
      console.log("   This is a CONTRADICTION!");
    } else {
      console.log("   ✅ This should work");
    }
  } else {
    console.log("   sendLibrary[_sender][_dstEid] != DEFAULT_LIB");
    console.log("   So getSendLibrary() returns sendLibrary[_sender][_dstEid] directly");
    console.log("   Which is:", lib);
    if (lib === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ This is zero address!");
      console.log("   But getSendLibrary() returned it, so it's not checking default");
    } else {
      console.log("   ✅ This should work");
    }
  }

  // Test with USDCKrumpOFT address
  console.log("\n5. Testing with USDCKrumpOFT address:");
  try {
    const oftDeployment = JSON.parse(fs.readFileSync("deployments/base-sepolia-oft-latest.json", "utf8"));
    const oftAddress = oftDeployment.usdcKrumpOft;
    
    const oftLib = await endpoint.getSendLibrary(oftAddress, dstEid);
    const oftIsDefault = await endpoint.isDefaultSendLibrary(oftAddress, dstEid);
    
    console.log("   USDCKrumpOFT address:", oftAddress);
    console.log("   getSendLibrary():", oftLib);
    console.log("   isDefaultSendLibrary():", oftIsDefault);
    
    if (oftLib === "0x0000000000000000000000000000000000000000") {
      console.log("   ❌ USDCKrumpOFT also has zero library!");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
