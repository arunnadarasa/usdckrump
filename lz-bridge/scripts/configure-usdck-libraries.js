/**
 * Configure send/receive libraries for USDCKrumpOFT on Story Aeneid
 * Required for LayerZero V2 messaging
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  const storyEndpoint = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));

  console.log("⚙️  Configuring libraries for USDCKrumpOFT");
  console.log("   OFT:", storyOft.address);
  console.log("   SendUln302:", storyEndpoint.sendUln302);
  console.log("   ReceiveUln302:", storyEndpoint.receiveUln302);

  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", storyOft.address);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyEndpoint.endpointV2);

  // Check if we're the owner/delegate
  const owner = await oft.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not owner!");
    process.exit(1);
  }

  // Set send library for Base Sepolia (84532)
  console.log("\n1/2 Setting send library for Base Sepolia...");
  const tx1 = await endpoint.setSendLibrary(storyOft.address, 84532, storyEndpoint.sendUln302);
  await tx1.wait();
  console.log("   ✅ Send library set");

  // Set receive library for Base Sepolia
  console.log("2/2 Setting receive library for Base Sepolia...");
  const tx2 = await endpoint.setReceiveLibrary(storyOft.address, 84532, storyEndpoint.receiveUln302, 0);
  await tx2.wait();
  console.log("   ✅ Receive library set");

  console.log("\n✅ USDCKrumpOFT libraries configured!");
}

main().catch(console.error);
