/**
 * Check if we're using the wrong EID for Base Sepolia
 * LayerZero AI suggests Base Sepolia EID is 40245, not 84532 (chain ID)
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Checking EID Configuration\n");
  console.log("Deployed EndpointV2:", ownEndpoint.endpointV2);
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // Check what EID the endpoint was deployed with
  const deployedEid = await endpoint.eid();
  console.log("1. Endpoint EID (from contract):", deployedEid.toString());
  console.log("   Chain ID (Base Sepolia):", 84532);
  console.log("   LayerZero EID (Base Sepolia):", 40245, "(per LayerZero AI)");
  console.log("   Match with chain ID:", deployedEid === 84532n ? "✅" : "❌");
  console.log("   Match with LayerZero EID:", deployedEid === 40245n ? "✅" : "❌");
  
  if (deployedEid !== 40245n) {
    console.log("\n⚠️  ISSUE FOUND!");
    console.log("   Endpoint was deployed with EID:", deployedEid.toString());
    console.log("   But Base Sepolia's LayerZero EID is: 40245");
    console.log("   This mismatch could cause routing issues!");
  }
  
  // Check if libraries are configured for the correct EIDs
  console.log("\n2. Checking library configuration:");
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  
  // Check send library for Story Aeneid (EID 1315)
  try {
    const lib = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   getSendLibrary(oapp, 1315):", lib);
    console.log("   Story Aeneid EID (1315): ✅ Correct");
  } catch (e) {
    console.log("   Error checking EID 1315:", e.message);
  }
  
  // Check if we can get library for Base Sepolia's correct EID (40245)
  try {
    const lib40245 = await endpoint.getSendLibrary(baseOft.address, 40245);
    console.log("   getSendLibrary(oapp, 40245):", lib40245);
    console.log("   Base Sepolia LayerZero EID (40245):", lib40245 !== "0x0000000000000000000000000000000000000000" ? "✅ Configured" : "❌ Not configured");
  } catch (e) {
    console.log("   Error checking EID 40245:", e.message);
  }
  
  console.log("\n3. Testing quote() with different EIDs:");
  const [signer] = await hre.ethers.getSigners();
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  
  // Test with Story Aeneid EID (1315) - this should work
  console.log("\n   Testing with Story Aeneid EID (1315):");
  try {
    const params1315 = {
      dstEid: 1315,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };
    const fee1315 = await endpoint.quote(params1315, baseOft.address);
    console.log("   ✅ quote() with EID 1315: SUCCESS");
    console.log("   Native fee:", hre.ethers.formatEther(fee1315.nativeFee));
  } catch (e) {
    console.log("   ❌ quote() with EID 1315: FAILED");
    console.log("   Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
  }
  
  // Test with Base Sepolia's LayerZero EID (40245) - if endpoint was deployed wrong
  console.log("\n   Testing with Base Sepolia LayerZero EID (40245):");
  try {
    const params40245 = {
      dstEid: 40245,
      receiver: recipient,
      message: "0x",
      options: "0x",
      payInLzToken: false
    };
    const fee40245 = await endpoint.quote(params40245, baseOft.address);
    console.log("   ✅ quote() with EID 40245: SUCCESS");
    console.log("   Native fee:", hre.ethers.formatEther(fee40245.nativeFee));
  } catch (e) {
    console.log("   ❌ quote() with EID 40245: FAILED");
    console.log("   Error:", e.message);
  }
  
  console.log("\n✅ EID check complete");
  console.log("\n💡 If endpoint EID mismatch is the issue:");
  console.log("   1. Redeploy EndpointV2 with EID 40245 (not 84532)");
  console.log("   2. Reconfigure libraries");
  console.log("   3. Test quote() again");
}

main().catch(console.error);
