/**
 * Check if _assertAtLeastOneDVN is causing the issue
 * The error might be that ULN config has 0 DVNs, causing _assertAtLeastOneDVN to fail
 * But wait - that would be LZ_ULN_AtLeastOneDVN, not LZ_DefaultSendLibUnavailable
 * 
 * Actually, let me check if getUlnConfig() calls endpoint.getConfig() which might trigger getSendLibrary()
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔍 Checking ULN Config Assertion\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const testSender = signer.address;
  const dstEid = 1315;

  // Check ULN config for test sender
  console.log("1. Checking ULN config for test sender:");
  try {
    // Get config via endpoint.getConfig()
    const ulnConfigBytes = await endpoint.getConfig(testSender, ownEndpoint.sendUln302, dstEid, 2);
    const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      ulnConfigBytes
    )[0];
    
    console.log("   Confirmations:", ulnConfig.confirmations.toString());
    console.log("   Required DVN count:", ulnConfig.requiredDVNCount.toString());
    console.log("   Optional DVN count:", ulnConfig.optionalDVNCount.toString());
    console.log("   Optional DVN threshold:", ulnConfig.optionalDVNThreshold.toString());
    console.log("   Required DVNs:", ulnConfig.requiredDVNs.length);
    console.log("   Optional DVNs:", ulnConfig.optionalDVNs.length);
    
    // Check if this would pass _assertAtLeastOneDVN
    const hasAtLeastOneDVN = ulnConfig.requiredDVNCount > 0 || ulnConfig.optionalDVNThreshold > 0;
    console.log("   Has at least one DVN:", hasAtLeastOneDVN ? "✅" : "❌");
    
    if (!hasAtLeastOneDVN) {
      console.log("\n   ⚠️  ULN config has 0 DVNs!");
      console.log("   This would cause LZ_ULN_AtLeastOneDVN, not LZ_DefaultSendLibUnavailable");
      console.log("   But let's check if getUlnConfig() calls something that triggers the error");
    }
  } catch (e) {
    console.log("   Error:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
  }

  // Check default ULN config
  console.log("\n2. Checking default ULN config:");
  try {
    const defaultConfigBytes = await endpoint.getConfig(
      "0x0000000000000000000000000000000000000000",
      ownEndpoint.sendUln302,
      dstEid,
      2
    );
    const defaultConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)"],
      defaultConfigBytes
    )[0];
    
    console.log("   Default confirmations:", defaultConfig.confirmations.toString());
    console.log("   Default required DVN count:", defaultConfig.requiredDVNCount.toString());
    console.log("   Default optional DVN count:", defaultConfig.optionalDVNCount.toString());
    console.log("   Default optional DVN threshold:", defaultConfig.optionalDVNThreshold.toString());
    
    const defaultHasDVN = defaultConfig.requiredDVNCount > 0 || defaultConfig.optionalDVNThreshold > 0;
    console.log("   Default has at least one DVN:", defaultHasDVN ? "✅" : "❌");
    
    if (!defaultHasDVN) {
      console.log("\n   ⚠️  Default ULN config has 0 DVNs!");
      console.log("   This would cause _isSupportedEid() to return false");
      console.log("   Which would cause LZ_ULN_UnsupportedEid, not LZ_DefaultSendLibUnavailable");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  // Test _isSupportedEid directly
  console.log("\n3. Testing _isSupportedEid():");
  try {
    const isSupported = await sendUln.isSupportedEid(dstEid);
    console.log("   isSupportedEid(1315):", isSupported ? "✅" : "❌");
    
    if (!isSupported) {
      console.log("\n   ⚠️  EID 1315 is NOT supported!");
      console.log("   This means default ULN config has 0 DVNs");
      console.log("   But this would cause LZ_ULN_UnsupportedEid, not LZ_DefaultSendLibUnavailable");
    }
  } catch (e) {
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Check complete");
  console.log("\n💡 The error LZ_DefaultSendLibUnavailable() must be coming from");
  console.log("   EndpointV2.getSendLibrary() being called internally, even though");
  console.log("   it works externally. This suggests a storage read bug during internal calls.");
}

main().catch(console.error);
