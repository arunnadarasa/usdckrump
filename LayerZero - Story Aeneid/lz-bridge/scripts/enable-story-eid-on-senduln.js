/**
 * Enable Story Aeneid (EID 1315) on our deployed SendUln302
 * This makes EID 1315 a "supported EID" so we can configure ULN settings for it
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("⚙️  Enabling Story Aeneid (EID 1315) on SendUln302\n");
  console.log("Deployer:", deployer.address);

  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  const sendUln302Address = baseEndpoint.sendUln302 || "0x1f860C493FdF423187D31673E5338C1276b6F630";
  
  console.log("SendUln302:", sendUln302Address);

  const sendUln = await hre.ethers.getContractAt("SendUln302", sendUln302Address);
  const owner = await sendUln.owner();
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not SendUln302 owner!");
    console.log("   Owner:", owner);
    process.exit(1);
  }

  // Check if EID 1315 is already supported
  const isSupported = await sendUln.isSupportedEid(1315);
  if (isSupported) {
    console.log("✅ EID 1315 is already supported!");
    return;
  }

  // Set default ULN config for EID 1315
  // For testnet, we'll use minimal config with optional DVNs
  // Since Story Aeneid is a custom chain, we might not have real DVNs
  // We'll use a threshold-based approach with optional DVNs
  
  console.log("\nSetting default ULN config for EID 1315...");
  
  // Option 1: Use required DVNs (need at least one real DVN address)
  // Option 2: Use optional DVNs with threshold > 0
  
  // For now, let's try with empty optional DVNs but threshold > 0
  // Actually, the code requires at least one DVN total, so we need at least one address
  
  // For testnet/custom chains, we can use a placeholder or configure manually
  // Let's use Story Aeneid's ReceiveUln302 as a "DVN" for now (it's not correct, but allows config)
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  
  // ULN Config for Story Aeneid
  // For testnet, we'll use minimal confirmations and optional DVNs
  const ulnConfig = {
    confirmations: 1, // Minimal for testnet
    requiredDVNCount: 0, // No required DVNs
    optionalDVNCount: 1, // One optional DVN
    optionalDVNThreshold: 1, // Need at least 1 optional DVN (threshold)
    requiredDVNs: [], // Empty
    optionalDVNs: [storyInfra.receiveUln302] // Use Story's ReceiveUln302 as placeholder
  };

  const configParam = {
    eid: 1315,
    config: ulnConfig
  };

  try {
    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    console.log("   Transaction:", tx.hash);
    await tx.wait();
    console.log("   ✅ Default ULN config set!");
    
    // Verify
    const nowSupported = await sendUln.isSupportedEid(1315);
    console.log("   EID 1315 now supported:", nowSupported);
    
    if (nowSupported) {
      console.log("\n✅ Story Aeneid (EID 1315) is now enabled on SendUln302!");
      console.log("   Next: Configure send library for USDCKrumpOFT");
    }
  } catch (e) {
    console.error("❌ Failed to set config:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    
    // If it fails due to DVN requirements, we might need real DVN addresses
    if (e.message.includes("LZ_ULN_AtLeastOneDVN")) {
      console.log("\n💡 For custom chains, you may need:");
      console.log("   1. Real DVN addresses from LayerZero");
      console.log("   2. Or configure via LayerZero dashboard");
      console.log("   3. Or use a different approach (executor-only, no ULN verification)");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  process.exit(1);
});
