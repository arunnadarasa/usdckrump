const hre = require("hardhat");
const fs = require("fs");

/**
 * Set default receive library on Story Aeneid endpoint for Base Sepolia
 * This allows all OApps to receive messages from Base Sepolia by default
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("⚙️  Setting Default Receive Library for Base Sepolia\n");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  const storyInfra = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Configuration:");
  console.log(`   Endpoint: ${storyInfra.endpointV2}`);
  console.log(`   ReceiveUln302: ${storyInfra.receiveUln302}`);
  console.log(`   Base Sepolia EID: 84532\n`);

  const endpoint = await hre.ethers.getContractAt(
    "EndpointV2",
    storyInfra.endpointV2
  );

  // Check owner
  const owner = await endpoint.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the endpoint owner!");
    console.log(`   Owner: ${owner}`);
    console.log(`   Deployer: ${deployer.address}\n`);
    process.exit(1);
  }

  console.log("✅ Deployer is endpoint owner\n");

  // Check if already set
  const currentLib = await endpoint.defaultReceiveLibrary(84532);
  if (currentLib === storyInfra.receiveUln302) {
    console.log("✅ Default receive library already configured!\n");
    return;
  }

  if (currentLib !== "0x0000000000000000000000000000000000000000") {
    console.log(`⚠️  Different library already set: ${currentLib}`);
    console.log(`   Will replace with: ${storyInfra.receiveUln302}\n`);
  }

  // Set default receive library
  console.log("📤 Setting default receive library...");
  console.log(`   EID: 84532 (Base Sepolia)`);
  console.log(`   Library: ${storyInfra.receiveUln302}`);
  console.log(`   Grace Period: 0 (no timeout)\n`);

  const tx = await endpoint.setDefaultReceiveLibrary(
    84532, // Base Sepolia EID
    storyInfra.receiveUln302,
    0 // No grace period
  );

  console.log(`⏳ Transaction: ${tx.hash}`);
  console.log("   Waiting for confirmation...\n");

  const receipt = await tx.wait();
  console.log("✅ Default receive library configured!");
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);

  console.log("=".repeat(60));
  console.log("\n✅ Story Aeneid is now ready to receive messages from Base Sepolia!");
  console.log("   All OApps on Story Aeneid can now receive from Base Sepolia by default.\n");
}

main().catch((error) => {
  console.error("❌ Configuration failed:", error);
  process.exit(1);
});
