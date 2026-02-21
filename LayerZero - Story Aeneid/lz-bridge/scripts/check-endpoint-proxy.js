/**
 * Check if EndpointV2 is a proxy contract
 * If it is, storage reads might be going to the wrong implementation
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Checking if EndpointV2 is a Proxy\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  // Check EIP-1967 implementation slot
  console.log("1. Checking EIP-1967 implementation slot:");
  try {
    // EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implAddress = await hre.ethers.provider.getStorage(endpoint.target, implSlot);
    console.log("   Implementation slot value:", implAddress);
    
    if (implAddress !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("   ⚠️  EndpointV2 appears to be a PROXY!");
      console.log("   Implementation address:", hre.ethers.getAddress("0x" + implAddress.slice(-40)));
      console.log("   This could cause storage read issues");
    } else {
      console.log("   ✅ EndpointV2 is NOT a proxy (direct implementation)");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check admin slot
  console.log("\n2. Checking EIP-1967 admin slot:");
  try {
    const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const adminAddress = await hre.ethers.provider.getStorage(endpoint.target, adminSlot);
    console.log("   Admin slot value:", adminAddress);
    
    if (adminAddress !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("   Admin address:", hre.ethers.getAddress("0x" + adminAddress.slice(-40)));
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Check if endpoint has proxy-related functions
  console.log("\n3. Checking for proxy-related functions:");
  try {
    // Try to call implementation() if it exists
    try {
      const impl = await endpoint.implementation();
      console.log("   implementation():", impl);
      console.log("   ⚠️  EndpointV2 has implementation() function - likely a proxy");
    } catch {
      console.log("   ✅ No implementation() function");
    }
    
    // Try proxyAdmin() if it exists
    try {
      const admin = await endpoint.proxyAdmin();
      console.log("   proxyAdmin():", admin);
      console.log("   ⚠️  EndpointV2 has proxyAdmin() function - likely a proxy");
    } catch {
      console.log("   ✅ No proxyAdmin() function");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Compare bytecode
  console.log("\n4. Checking bytecode:");
  try {
    const deployedCode = await hre.ethers.provider.getCode(endpoint.target);
    console.log("   Deployed code length:", deployedCode.length);
    
    // If code is very short, it's likely a proxy
    if (deployedCode.length < 1000) {
      console.log("   ⚠️  Code is very short - likely a proxy");
    } else {
      console.log("   ✅ Code is substantial - likely direct implementation");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
  console.log("\n💡 If EndpointV2 is a proxy, storage reads during internal calls");
  console.log("   might be reading from the wrong contract, causing the error.");
}

main().catch(console.error);
