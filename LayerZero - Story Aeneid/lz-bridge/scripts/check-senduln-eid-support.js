/**
 * Check if SendUln302 supports EID 1315 (Story Aeneid)
 * The error might be that SendUln302 doesn't support this EID
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Checking SendUln302 EID Support\n");
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Story Aeneid EID: 1315\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  // Check if SendUln302 supports EID 1315
  console.log("1. Checking if SendUln302 supports EID 1315:");
  try {
    const isSupported = await sendUln.isSupportedEid(1315);
    console.log("   isSupportedEid(1315):", isSupported ? "✅ Yes" : "❌ No");
    
    if (!isSupported) {
      console.log("\n   ⚠️  SendUln302 does NOT support EID 1315!");
      console.log("   This would cause LZ_DefaultSendLibUnavailable()");
      console.log("   Need to configure SendUln302 for Story Aeneid");
    }
  } catch (e) {
    console.log("   Error:", e.message);
    // Maybe the function doesn't exist, try checking config instead
  }

  // Check ULN config for EID 1315
  console.log("\n2. Checking ULN config for EID 1315:");
  try {
    const config = await sendUln.defaultUlnConfig(1315);
    console.log("   defaultUlnConfig(1315):", config);
    console.log("   Config exists:", config.confirmations > 0n ? "✅" : "❌");
  } catch (e) {
    console.log("   Error:", e.message);
    // Try alternative method
    try {
      const configBytes = await sendUln.getConfig(1315);
      console.log("   getConfig(1315) bytes length:", configBytes.length);
    } catch (e2) {
      console.log("   Alternative check also failed:", e2.message);
    }
  }

  // Check what EIDs are supported
  console.log("\n3. Testing common EIDs:");
  const testEids = [1315, 40245, 84532];
  for (const eid of testEids) {
    try {
      const isSupported = await sendUln.isSupportedEid(eid);
      console.log(`   EID ${eid}:`, isSupported ? "✅ Supported" : "❌ Not supported");
    } catch (e) {
      console.log(`   EID ${eid}: Error checking`);
    }
  }

  // Check endpoint
  console.log("\n4. Checking SendUln302 endpoint:");
  try {
    const ulnEndpoint = await sendUln.endpoint();
    console.log("   SendUln302 endpoint:", ulnEndpoint);
    console.log("   Expected endpoint:", ownEndpoint.endpointV2);
    console.log("   Match:", ulnEndpoint.toLowerCase() === ownEndpoint.endpointV2.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
}

main().catch(console.error);
