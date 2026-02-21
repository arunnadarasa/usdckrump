/**
 * Configure Story Aeneid endpoint for Base Sepolia (EID 40245)
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
  console.log("⚙️  Configuring Story Aeneid Endpoint for Base Sepolia\n");
  console.log("Deployer:", deployer.address);

  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyInfra.endpointV2);

  console.log("Endpoint:", storyInfra.endpointV2);
  console.log("SendUln302:", storyInfra.sendUln302);
  console.log("ReceiveUln302:", storyInfra.receiveUln302);
  console.log("Base Sepolia EID: 40245\n");

  // Verify we're the owner
  const owner = await endpoint.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    console.log("   Owner:", owner);
    process.exit(1);
  }
  console.log("✅ Verified as endpoint owner\n");

  // Check if libraries are registered
  console.log("1. Checking library registration...");
  const sendLibRegistered = await endpoint.isRegisteredLibrary(storyInfra.sendUln302);
  const receiveLibRegistered = await endpoint.isRegisteredLibrary(storyInfra.receiveUln302);
  
  if (!sendLibRegistered) {
    console.log("   Registering SendUln302...");
    const txReg1 = await endpoint.registerLibrary(storyInfra.sendUln302);
    await txReg1.wait();
    console.log("   ✅ SendUln302 registered");
  } else {
    console.log("   ✅ SendUln302 already registered");
  }

  if (!receiveLibRegistered) {
    console.log("   Registering ReceiveUln302...");
    const txReg2 = await endpoint.registerLibrary(storyInfra.receiveUln302);
    await txReg2.wait();
    console.log("   ✅ ReceiveUln302 registered");
  } else {
    console.log("   ✅ ReceiveUln302 already registered");
  }

  // Configure SendUln302 to support Base Sepolia FIRST
  console.log("\n2. Configuring SendUln302 for Base Sepolia (EID 40245)...");
  const sendUln = await hre.ethers.getContractAt("SendUln302", storyInfra.sendUln302);
  const sendUlnOwner = await sendUln.owner();
  
  const sendSupports = await sendUln.isSupportedEid(40245);
  if (sendSupports) {
    console.log("   ✅ SendUln302 already supports EID 40245");
  } else if (sendUlnOwner.toLowerCase() === deployer.address.toLowerCase()) {
    // For Base Sepolia, use minimal config
    const ulnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [],
      optionalDVNs: []
    };

    const configParam = {
      eid: 40245,
      config: ulnConfig
    };

    try {
      const txSendUln = await sendUln.setDefaultUlnConfigs([configParam]);
      await txSendUln.wait();
      console.log("   ✅ SendUln302 configured for Base Sepolia");
      
      const nowSupports = await sendUln.isSupportedEid(40245);
      console.log("   EID 40245 now supported:", nowSupports);
    } catch (e) {
      console.error("   ❌ SendUln302 config failed:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      console.log("   Continuing anyway...");
    }
  } else {
    console.log("   ⚠️  Not SendUln302 owner (owner:", sendUlnOwner, ")");
  }

  // Set default send library for Base Sepolia (EID 40245)
  console.log("\n3. Setting default send library for Base Sepolia (EID 40245)...");
  try {
    const tx1 = await endpoint.setDefaultSendLibrary(40245, storyInfra.sendUln302);
    await tx1.wait();
    console.log("   ✅ Default send library set");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  // Set default receive library for Base Sepolia
  console.log("\n4. Setting default receive library for Base Sepolia (EID 40245)...");
  try {
    const tx2 = await endpoint.setDefaultReceiveLibrary(40245, storyInfra.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Default receive library set");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }


  console.log("\n✅ Configuration complete!");
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
