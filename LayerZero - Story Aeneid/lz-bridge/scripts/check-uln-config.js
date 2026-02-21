const hre = require("hardhat");
const fs = require("fs");

/**
 * Check ULN library configuration for cross-chain transfers
 * Checks both Base Sepolia and Story Aeneid configurations
 */

async function main() {
  console.log("🔍 Checking ULN Library Configuration\n");
  console.log("=".repeat(60));

  // Load deployments
  const baseDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Contract Addresses:");
  console.log(`   Base Sepolia OFT: ${baseDeployment.address}`);
  console.log(`   Story Aeneid OFT: ${storyDeployment.address}`);
  console.log(`   Base Sepolia Endpoint: ${baseDeployment.endpoint}`);
  const storyInfra = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );
  console.log(`   Story Aeneid Endpoint: ${storyDeployment.endpoint}\n`);

  // Check Base Sepolia (using official LayerZero endpoint)
  console.log("1️⃣ Checking Base Sepolia Configuration...");
  const baseProvider = new hre.ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
  );
  
  const baseEndpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    baseDeployment.endpoint,
    baseProvider
  );

  try {
    // Check default libraries for Story Aeneid (EID 1315)
    const defaultSendLib = await baseEndpoint.defaultSendLibrary(1315);
    const defaultReceiveLib = await baseEndpoint.defaultReceiveLibrary(1315);
    
    console.log(`   Default Send Library (EID 1315): ${defaultSendLib}`);
    console.log(`   Default Receive Library (EID 1315): ${defaultReceiveLib}\n`);

    // Check OApp-specific library configuration
    const baseOFT = await hre.ethers.getContractAt(
      "USDCDanceOFT",
      baseDeployment.address,
      baseProvider
    );

    const oappSendLib = await baseEndpoint.getSendLibrary(baseDeployment.address, 1315);
    const isDefaultSend = await baseEndpoint.isDefaultSendLibrary(baseDeployment.address, 1315);
    
    console.log(`   OApp Send Library (EID 1315): ${oappSendLib}`);
    console.log(`   Using Default: ${isDefaultSend}\n`);

    if (defaultSendLib === "0x0000000000000000000000000000000000000000" && !isDefaultSend && oappSendLib === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  No send library configured for Story Aeneid!");
      console.log("   💡 Need to configure send library on Base Sepolia\n");
    } else {
      console.log("   ✅ Send library configured\n");
    }
  } catch (error) {
    console.log(`   ❌ Error checking Base Sepolia: ${error.message}\n`);
  }

  // Check Story Aeneid
  console.log("2️⃣ Checking Story Aeneid Configuration...");
  const storyProvider = new hre.ethers.JsonRpcProvider(
    process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io"
  );

  const storyEndpoint = await hre.ethers.getContractAt(
    "EndpointV2",
    storyDeployment.endpoint,
    storyProvider
  );

  try {
    // Check default libraries for Base Sepolia (EID 84532)
    const defaultSendLib = await storyEndpoint.defaultSendLibrary(84532);
    const defaultReceiveLib = await storyEndpoint.defaultReceiveLibrary(84532);
    
    console.log(`   Default Send Library (EID 84532): ${defaultSendLib}`);
    console.log(`   Default Receive Library (EID 84532): ${defaultReceiveLib}\n`);

    // Check OApp-specific library configuration
    const storyOFT = await hre.ethers.getContractAt(
      "USDCDanceOFT",
      storyDeployment.address,
      storyProvider
    );

    const [receiveLib, isDefaultReceive] = await storyEndpoint.getReceiveLibrary(storyDeployment.address, 84532);
    
    console.log(`   OApp Receive Library (EID 84532): ${receiveLib}`);
    console.log(`   Using Default: ${isDefaultReceive}\n`);

    if (defaultReceiveLib === "0x0000000000000000000000000000000000000000" && receiveLib === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  No receive library configured for Base Sepolia!");
      console.log(`   💡 Need to configure receive library: ${storyInfra.receiveUln302}\n`);
    } else {
      console.log("   ✅ Receive library configured\n");
    }
  } catch (error) {
    console.log(`   ❌ Error checking Story Aeneid: ${error.message}\n`);
  }

  console.log("=".repeat(60));
  console.log("\n💡 Next Steps:");
  console.log("   If libraries are not configured, you may need to:");
  console.log("   1. Configure send library on Base Sepolia for EID 1315");
  console.log("   2. Configure receive library on Story Aeneid for EID 84532");
  console.log("   3. Use LayerZero's official libraries or your custom ULN infrastructure\n");
}

main().catch((error) => {
  console.error("❌ Check failed:", error);
  process.exit(1);
});
