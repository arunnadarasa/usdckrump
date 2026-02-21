/**
 * Configure Story Aeneid SendUln302 for Base Sepolia with DVN
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
  console.log("⚙️  Configuring SendUln302 for Base Sepolia\n");
  console.log("Deployer:", deployer.address);

  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  const sendUln = await hre.ethers.getContractAt("SendUln302", storyInfra.sendUln302);
  const sendUlnOwner = await sendUln.owner();
  
  console.log("SendUln302:", storyInfra.sendUln302);
  console.log("Base Sepolia ReceiveUln302:", baseEndpoint.receiveUln302);
  console.log("Base Sepolia EID: 40245\n");

  if (sendUlnOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not SendUln302 owner!");
    console.log("   Owner:", sendUlnOwner);
    process.exit(1);
  }

  // Check if already configured
  const isSupported = await sendUln.isSupportedEid(40245);
  if (isSupported) {
    console.log("✅ SendUln302 already supports EID 40245");
    return;
  }

  // Configure with Base Sepolia's ReceiveUln302 as DVN
  // This allows messages to be verified on Base Sepolia
  const ulnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [baseEndpoint.receiveUln302] // Use Base Sepolia's receive library as DVN
  };

  const configParam = {
    eid: 40245,
    config: ulnConfig
  };

  console.log("Setting ULN config for Base Sepolia...");
  try {
    const tx = await sendUln.setDefaultUlnConfigs([configParam]);
    await tx.wait();
    console.log("✅ SendUln302 configured for Base Sepolia (EID 40245)");
    
    const nowSupports = await sendUln.isSupportedEid(40245);
    console.log("   EID 40245 now supported:", nowSupports);
  } catch (e) {
    console.error("❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  console.log("\n✅ Configuration complete");
}

main().catch(console.error);
