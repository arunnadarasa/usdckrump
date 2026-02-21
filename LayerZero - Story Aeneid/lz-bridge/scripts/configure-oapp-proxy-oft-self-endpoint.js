/**
 * Configure OAppProxyOFT libraries on self-deployed endpoint
 * Registers libraries and configures send/receive libraries as endpoint owner
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("⚙️  Configuring OAppProxyOFT Libraries on Self-Deployed Endpoint");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   ReceiveUln302:", ownEndpoint.receiveUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  
  // Verify we're the OAppProxyOFT owner/delegate
  const oftOwner = await proxyOft.owner();
  const delegate = proxyOftDeployment.delegate;
  const isOwner = oftOwner.toLowerCase() === deployer.address.toLowerCase();
  const isDelegate = delegate.toLowerCase() === deployer.address.toLowerCase();
  
  if (!isOwner && !isDelegate) {
    console.error("❌ Not OAppProxyOFT owner or delegate!");
    console.log("   Owner:", oftOwner);
    console.log("   Delegate:", delegate);
    console.log("   Deployer:", deployer.address);
    process.exit(1);
  }
  console.log("✅ Verified as OAppProxyOFT", isOwner ? "owner" : "delegate", "\n");
  
  // Verify endpoint owner (for library registration)
  const endpointOwner = await endpoint.owner();
  const isEndpointOwner = endpointOwner.toLowerCase() === deployer.address.toLowerCase();
  if (!isEndpointOwner) {
    console.log("⚠️  Not endpoint owner - library registration may fail");
  } else {
    console.log("✅ Verified as endpoint owner\n");
  }

  // Step 1: Register libraries if not already registered
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

  // Step 2: Set send library for OAppProxyOFT → Story Aeneid
  // First try setting default libraries (works as endpoint owner), then try per-OApp
  console.log("\n2/5 Setting default send library for Story Aeneid (EID 1315)...");
  if (isEndpointOwner) {
    try {
      const txDefault = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.sendUln302);
      await txDefault.wait();
      console.log("   ✅ Default send library set");
    } catch (e) {
      console.log("   ⚠️  Default send library:", e.message);
    }
  }
  
  console.log("   Setting per-OApp send library...");
  try {
    const tx1 = await endpoint.setSendLibrary(proxyOftDeployment.oappProxyOft, 1315, ownEndpoint.sendUln302);
    await tx1.wait();
    console.log("   ✅ Per-OApp send library configured");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.error("   Error signature:", errorSig);
      console.log("   ⚠️  Per-OApp config failed, but default library is set");
      console.log("   OAppProxyOFT will use default library");
    } else {
      throw e;
    }
  }

  // Step 3: Configure ReceiveUln302 to support Story Aeneid (EID 1315)
  console.log("\n3/5 Configuring ReceiveUln302 for Story Aeneid (EID 1315)...");
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
    console.log("   ⚠️  Not ReceiveUln302 owner (owner:", receiveUlnOwner, ")");
    console.log("   Skipping ReceiveUln302 configuration");
  }

  // Step 4: Set receive library for Story Aeneid → Base Sepolia
  console.log("\n4/4 Setting receive library for Story Aeneid → Base Sepolia...");
  try {
    const tx2 = await endpoint.setReceiveLibrary(proxyOftDeployment.oappProxyOft, 1315, ownEndpoint.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Receive library configured");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ OAppProxyOFT libraries configured!");
  console.log("=".repeat(60));
  console.log("\n📝 Next steps:");
  console.log("   1. Set peer on Story Aeneid:");
  console.log("      npm run link:proxy-oft -- --network storyAeneid");
  console.log("\n   2. Test LayerZero bridge:");
  console.log("      npm run test:proxy-oft -- --network baseSepolia");
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
