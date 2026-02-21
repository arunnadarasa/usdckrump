/**
 * Configure SendUln302 to support Story Aeneid (EID 1315)
 * This is required before quote() will work
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  console.log("⚙️  Configuring SendUln302 for Story Aeneid\n");
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Story Aeneid ReceiveUln302:", storyInfra.receiveUln302);
  console.log("Story Aeneid EID: 1315\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  // Configure Story Aeneid (EID 1315) on SendUln302
  const ulnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [storyInfra.receiveUln302]
  };

  const configParam = {
    eid: 1315,
    config: ulnConfig
  };

  console.log("Setting ULN config for Story Aeneid...");
  try {
    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    await tx.wait();
    console.log("✅ SendUln302 configured for Story Aeneid (EID 1315)");
    
    // Verify
    const config = await sendUln.defaultUlnConfig(1315);
    console.log("   Verified config exists for EID 1315");
  } catch (e) {
    console.error("❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  console.log("\n✅ Configuration complete");
}

main().catch(console.error);
