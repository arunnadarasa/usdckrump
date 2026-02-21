/**
 * Configure USDCKrumpOFT to use ULN libraries via OApp's setConfig
 * This works around the lack of admin permissions on LayerZero's official endpoint
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
  console.log("⚙️  Configuring USDCKrumpOFT ULN via OApp setConfig\n");
  console.log("Deployer:", deployer.address);

  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const owner = await oft.owner();
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not OApp owner!");
    console.log("   Owner:", owner);
    process.exit(1);
  }

  console.log("OFT:", baseOft.address);
  console.log("Using SendUln302:", baseEndpoint.sendUln302 || "0x1f860C493FdF423187D31673E5338C1276b6F630");
  console.log("Story ReceiveUln302:", storyInfra.receiveUln302, "\n");

  // Use our deployed SendUln302 (or the one we just deployed)
  const sendUln302 = baseEndpoint.sendUln302 || "0x1f860C493FdF423187D31673E5338C1276b6F630";
  
  // Get SendUln302 contract to configure ULN settings
  const sendUln = await hre.ethers.getContractAt("SendUln302", sendUln302);
  
  // For testnet, we can use minimal ULN config
  // ULN config requires: executorConfig and ulnConfig
  // For Story Aeneid (EID 1315), we need to configure:
  // - Executor: Story Aeneid's executor address
  // - ULN: DVN addresses (for testnet, we might be able to use empty or minimal)
  
  console.log("1/2 Configuring Executor for Story Aeneid...");
  // ExecutorConfig: { executor, lzReceiveOption }
  const executorConfig = {
    executor: storyInfra.executor || "0x0000000000000000000000000000000000000000",
    lzReceiveOption: {
      gas: 200000,
      value: 0
    }
  };

  // ULN Config: { confirmations, requiredDVNs, optionalDVNs }
  // For testnet with custom chain, we might need to use empty DVNs or configure manually
  console.log("2/2 Configuring ULN for Story Aeneid...");
  const ulnConfig = {
    confirmations: 1, // Minimal confirmations for testnet
    requiredDVNs: [], // Empty for testnet - will need manual verification
    optionalDVNs: []
  };

  // Set config via SendUln302's setConfig (called by endpoint)
  // But we need to call it through the endpoint, which requires permissions
  
  // Alternative: Try to use endpoint's setConfig if OApp has permissions
  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    baseEndpoint.endpointV2
  );

  // Try setting send library via endpoint (might work if OApp has some permissions)
  console.log("\nAttempting to set send library...");
  try {
    const tx1 = await endpoint.setSendLibrary(baseOft.address, 1315, sendUln302);
    await tx1.wait();
    console.log("✅ Send library set!");
  } catch (e) {
    console.log("⚠️  Cannot set send library via endpoint:", e.message);
    console.log("   This is expected on LayerZero's official endpoint");
  }

  // Configure ULN settings on SendUln302
  // This needs to be done via endpoint.setConfig -> SendUln302.setConfig
  console.log("\nConfiguring ULN settings...");
  try {
    // Set executor config
    const executorConfigParam = {
      eid: 1315,
      configType: 1, // CONFIG_TYPE_EXECUTOR
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address executor, tuple(uint128 gas, uint128 value) lzReceiveOption)"],
        [executorConfig]
      )
    };

    // Set ULN config  
    const ulnConfigParam = {
      eid: 1315,
      configType: 2, // CONFIG_TYPE_ULN
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint64 confirmations, address[] requiredDVNs, address[] optionalDVNs)"],
        [ulnConfig]
      )
    };

    // Call endpoint.setConfig which will forward to SendUln302.setConfig
    const tx2 = await endpoint.setConfig(
      baseOft.address,
      sendUln302,
      [executorConfigParam, ulnConfigParam]
    );
    await tx2.wait();
    console.log("✅ ULN config set!");
  } catch (e) {
    console.log("⚠️  Cannot set ULN config:", e.message);
    console.log("   May need admin permissions or different approach");
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Verify send library is set: check endpoint.getSendLibrary()");
  console.log("   2. For custom chains, you may need to configure via LayerZero dashboard");
  console.log("   3. Or use a relayer/executor worker to handle messages manually");
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
