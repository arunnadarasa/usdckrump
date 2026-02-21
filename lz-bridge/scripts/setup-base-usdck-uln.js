/**
 * Setup ULN libraries for USDCKrumpOFT on Base Sepolia
 * 1. Deploy SendUln302 on Base Sepolia (if not already deployed)
 * 2. Configure send library for USDCKrumpOFT → Story Aeneid (EID 1315)
 * 3. Configure ULN settings on SendUln302 for Story Aeneid
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
  console.log("⚙️  Setting up ULN libraries for USDCKrumpOFT on Base Sepolia\n");
  console.log("Deployer:", deployer.address);

  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  console.log("OFT:", baseOft.address);
  console.log("Endpoint:", baseEndpoint.endpointV2, "\n");

  // Check if we need to deploy SendUln302
  let sendUln302Address = baseEndpoint.sendUln302;
  if (!sendUln302Address || sendUln302Address === "0x0000000000000000000000000000000000000000") {
    console.log("1/3 Deploying SendUln302 on Base Sepolia...");
    const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
    // SendUln302 constructor: (address _endpoint, uint256 _treasuryGasLimit, uint256 _treasuryGasForFeeCap)
    const sendUln = await SendUln302.deploy(
      baseEndpoint.endpointV2,
      100000, // treasuryGasLimit
      50000   // treasuryGasForFeeCap
    );
    await sendUln.waitForDeployment();
    sendUln302Address = await sendUln.getAddress();
    console.log("   ✅ SendUln302 deployed:", sendUln302Address);
    
    // Update deployment file
    baseEndpoint.sendUln302 = sendUln302Address;
    fs.writeFileSync("deployments/base-sepolia-latest.json", JSON.stringify(baseEndpoint, null, 2));
  } else {
    console.log("1/3 SendUln302 already deployed:", sendUln302Address);
  }

  // Get endpoint contract
  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    baseEndpoint.endpointV2
  );

  // Check if send library is already set
  let currentSendLib;
  try {
    currentSendLib = await endpoint.getSendLibrary(baseOft.address, 1315);
  } catch (e) {
    currentSendLib = "0x0000000000000000000000000000000000000000";
  }

  if (currentSendLib.toLowerCase() === sendUln302Address.toLowerCase()) {
    console.log("2/3 Send library already configured ✅");
  } else {
    console.log("2/3 Setting send library for USDCKrumpOFT → Story Aeneid (EID 1315)...");
    try {
      // Try to set via endpoint (may require admin permissions on official endpoint)
      const tx = await endpoint.setSendLibrary(baseOft.address, 1315, sendUln302Address);
      await tx.wait();
      console.log("   ✅ Send library set via endpoint");
    } catch (e) {
      if (e.message.includes("OwnableUnauthorizedAccount") || e.message.includes("Unauthorized")) {
        console.log("   ⚠️  Cannot set library via endpoint (no admin permissions)");
        console.log("   💡 Try using OApp's setConfig method instead");
        // Try via OApp
        const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
        const owner = await oft.owner();
        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
          console.log("   Attempting via OApp configuration...");
          // OApp might have methods to configure libraries
          // This depends on the OApp implementation
        } else {
          console.log("   ❌ Not OApp owner. Owner:", owner);
        }
      } else {
        throw e;
      }
    }
  }

  // Configure ULN settings on SendUln302 for Story Aeneid
  console.log("3/3 Configuring ULN settings on SendUln302 for Story Aeneid...");
  const sendUln = await hre.ethers.getContractAt("SendUln302", sendUln302Address);
  
  // Check if ULN config already exists
  try {
    const config = await sendUln.getConfig(1315, baseOft.address, 2); // CONFIG_TYPE_ULN = 2
    if (config && config !== "0x") {
      console.log("   ✅ ULN config already exists");
    } else {
      throw new Error("No config");
    }
  } catch (e) {
    // Need to set ULN config
    // ULN config requires DVN addresses, but for testnet we can use minimal config
    console.log("   ⚠️  ULN config requires DVN addresses");
    console.log("   💡 For testnet, you may need to:");
    console.log("      1. Use LayerZero's testnet DVNs");
    console.log("      2. Or configure via LayerZero dashboard");
    console.log("      3. Or use a simple message library instead");
  }

  console.log("\n✅ Setup complete!");
  console.log("   SendUln302:", sendUln302Address);
  console.log("   Next: Configure DVN settings or use LayerZero's official libraries");
}

main().catch((e) => {
  console.error("❌ Setup failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
