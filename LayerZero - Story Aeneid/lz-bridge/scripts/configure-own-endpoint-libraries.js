/**
 * Configure libraries on our own EndpointV2 for USDCKrumpOFT
 * This gives us full control over LayerZero message routing
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
  console.log("⚙️  Configuring Libraries on Our Own EndpointV2");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   ReceiveUln302:", ownEndpoint.receiveUln302);
  console.log("   USDCKrumpOFT:", baseOft.address);
  console.log("   Story Aeneid EID: 1315\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  
  // Verify we're the owner
  const owner = await endpoint.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  // Check if libraries are already registered
  console.log("1/5 Checking library registration...");
  const sendLibRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  const receiveLibRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.receiveUln302);
  
  if (!sendLibRegistered) {
    console.log("   Registering SendUln302...");
    try {
      const txReg1 = await endpoint.registerLibrary(ownEndpoint.sendUln302);
      await txReg1.wait();
      console.log("   ✅ SendUln302 registered");
    } catch (e) {
      console.error("   ❌ Failed to register SendUln302:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else {
    console.log("   ✅ SendUln302 already registered");
  }

  if (!receiveLibRegistered) {
    console.log("   Registering ReceiveUln302...");
    try {
      const txReg2 = await endpoint.registerLibrary(ownEndpoint.receiveUln302);
      await txReg2.wait();
      console.log("   ✅ ReceiveUln302 registered");
    } catch (e) {
      console.error("   ❌ Failed to register ReceiveUln302:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else {
    console.log("   ✅ ReceiveUln302 already registered");
  }

  // Check delegate
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("   OApp delegate:", delegate);
  if (delegate.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("   ❌ Deployer is not the OApp delegate!");
    console.log("   Need to call as OApp owner or set delegate");
  }

  // 2. Set send library for USDCKrumpOFT → Story Aeneid
  // Need to call through OApp or as delegate
  console.log("\n2/5 Setting send library for USDCKrumpOFT → Story Aeneid...");
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const oftOwner = await oft.owner();
  console.log("   OApp owner:", oftOwner);
  
  // Try calling through endpoint (as delegate)
  try {
    const tx1 = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Send library configured");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    console.log("   💡 May need to call through OApp or verify delegate");
    process.exit(1);
  }

  // 3. Configure ReceiveUln302 to support Story Aeneid (EID 1315)
  console.log("3/6 Configuring ReceiveUln302 for Story Aeneid (EID 1315)...");
  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", ownEndpoint.receiveUln302);
  const receiveUlnOwner = await receiveUln.owner();
  
  const receiveSupports = await receiveUln.isSupportedEid(1315);
  if (receiveSupports) {
    console.log("   ✅ ReceiveUln302 already supports EID 1315");
  } else if (receiveUlnOwner.toLowerCase() === deployer.address.toLowerCase()) {
    const receiveUlnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [storyInfra.receiveUln302]
    };

    const receiveConfigParam = {
      eid: 1315,
      config: receiveUlnConfig
    };

    try {
      const txRecv = await receiveUln.setDefaultUlnConfigs([receiveConfigParam]);
      await txRecv.wait();
      console.log("   ✅ ReceiveUln302 configured for Story Aeneid");
      
      const nowSupports = await receiveUln.isSupportedEid(1315);
      console.log("   EID 1315 now supported:", nowSupports);
    } catch (e) {
      console.error("   ❌ ReceiveUln302 config failed:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else {
    console.error("   ❌ Not ReceiveUln302 owner!");
    console.log("   Owner:", receiveUlnOwner);
    process.exit(1);
  }

  // 4. Set receive library for Story Aeneid → Base Sepolia
  console.log("4/6 Setting receive library for Story Aeneid → Base Sepolia...");
  try {
    const tx2 = await endpoint.setReceiveLibrary(baseOft.address, 1315, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Receive library configured");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  // 5. Configure Executor settings via SendUln302 (if executor exists)
  console.log("5/6 Configuring Executor settings...");
  if (ownEndpoint.executor && ownEndpoint.executor !== "0x0000000000000000000000000000000000000000") {
    const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
    
    const executorConfig = {
      executor: storyInfra.executor || "0x0000000000000000000000000000000000000000",
      lzReceiveOption: {
        gas: 200000,
        value: 0
      }
    };

    const executorConfigParam = {
      eid: 1315,
      configType: 1, // CONFIG_TYPE_EXECUTOR
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address executor, tuple(uint128 gas, uint128 value) lzReceiveOption)"],
        [executorConfig]
      )
    };

    try {
      const tx3 = await endpoint.setConfig(
        baseOft.address,
        ownEndpoint.sendUln302,
        [executorConfigParam]
      );
      await tx3.wait();
      console.log("   ✅ Executor configured");
    } catch (e) {
      console.log("   ⚠️  Executor config failed (may need Story Aeneid executor):", e.message);
    }
  } else {
    console.log("   ⚠️  No executor deployed (using executor worker instead)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Libraries configured!");
  console.log("=".repeat(60));
  console.log("\n📝 Next steps:");
  console.log("   1. Link peers:");
  console.log("      npx hardhat run scripts/link-oft-krump.js");
  console.log("\n   2. Test LayerZero send:");
  console.log("      npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia");
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
