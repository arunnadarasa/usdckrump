/**
 * Configure Story Aeneid endpoint for receiving/sending to Base Sepolia
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  const baseInfra = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  console.log("⚙️  Configuring Story Aeneid for Base Sepolia");
  console.log("=".repeat(60));
  console.log("Endpoint:", storyInfra.endpointV2);
  console.log("SendUln302:", storyInfra.sendUln302);
  console.log("ReceiveUln302:", storyInfra.receiveUln302);
  console.log("USDCKrumpOFT:", storyOft.address);
  console.log("Base Sepolia EID: 84532\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyInfra.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", storyInfra.sendUln302);
  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", storyInfra.receiveUln302);

  // Verify ownership
  const endpointOwner = await endpoint.owner();
  const sendUlnOwner = await sendUln.owner();
  const receiveUlnOwner = await receiveUln.owner();

  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  // Step 1: Configure SendUln302 to support Base Sepolia (EID 84532)
  console.log("1/5 Configuring SendUln302 for Base Sepolia (EID 84532)...");
  const sendSupports = await sendUln.isSupportedEid(84532);
  if (!sendSupports && sendUlnOwner.toLowerCase() === deployer.address.toLowerCase()) {
    const sendUlnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [baseInfra.receiveUln302] // Use Base's ReceiveUln302 as placeholder DVN
    };

    const sendConfigParam = {
      eid: 84532,
      config: sendUlnConfig
    };

    try {
      const tx1 = await sendUln.setDefaultUlnConfigs([sendConfigParam]);
      await tx1.wait();
      console.log("   ✅ SendUln302 configured for Base Sepolia");
      
      const nowSupports = await sendUln.isSupportedEid(84532);
      console.log("   EID 84532 now supported:", nowSupports);
    } catch (e) {
      console.error("   ❌ Failed:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else if (sendSupports) {
    console.log("   ✅ SendUln302 already supports EID 84532");
  } else {
    console.log("   ⚠️  Not SendUln302 owner, skipping");
  }

  // Step 2: Configure ReceiveUln302 to support Base Sepolia (if needed)
  console.log("\n2/5 Checking ReceiveUln302 for Base Sepolia...");
  const receiveSupports = await receiveUln.isSupportedEid(84532);
  if (!receiveSupports && receiveUlnOwner.toLowerCase() === deployer.address.toLowerCase()) {
    const receiveUlnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [baseInfra.receiveUln302]
    };

    const receiveConfigParam = {
      eid: 84532,
      config: receiveUlnConfig
    };

    try {
      const tx2 = await receiveUln.setDefaultUlnConfigs([receiveConfigParam]);
      await tx2.wait();
      console.log("   ✅ ReceiveUln302 configured for Base Sepolia");
    } catch (e) {
      console.log("   ⚠️  ReceiveUln302 config failed:", e.message);
    }
  } else if (receiveSupports) {
    console.log("   ✅ ReceiveUln302 already supports EID 84532");
  }

  // Step 3: Set default send library for Base Sepolia
  console.log("\n3/5 Setting default send library for Base Sepolia...");
  try {
    const tx3 = await endpoint.setDefaultSendLibrary(84532, storyInfra.sendUln302);
    await tx3.wait();
    console.log("   ✅ Default send library set");
  } catch (e) {
    if (e.message.includes("LZ_SameValue")) {
      console.log("   ✅ Default send library already set");
    } else {
      console.error("   ❌ Failed:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  }

  // Step 4: Set default receive library for Base Sepolia (if not already set)
  console.log("4/5 Checking default receive library...");
  const defaultReceive = await endpoint.defaultReceiveLibrary(84532);
  if (defaultReceive.toLowerCase() !== storyInfra.receiveUln302.toLowerCase()) {
    try {
      const tx4 = await endpoint.setDefaultReceiveLibrary(84532, storyInfra.receiveUln302, 0);
      await tx4.wait();
      console.log("   ✅ Default receive library set");
    } catch (e) {
      console.log("   ⚠️  Failed:", e.message);
    }
  } else {
    console.log("   ✅ Default receive library already set");
  }

  // Step 5: Set OApp libraries for USDCKrumpOFT
  console.log("\n5/5 Setting OApp libraries for USDCKrumpOFT...");
  const delegate = await endpoint.delegates(storyOft.address);
  console.log("   OApp delegate:", delegate);
  console.log("   Deployer:", deployer.address);
  
  if (delegate.toLowerCase() === deployer.address.toLowerCase()) {
    // Set send library
    try {
      const tx5 = await endpoint.setSendLibrary(storyOft.address, 84532, storyInfra.sendUln302);
      await tx5.wait();
      console.log("   ✅ OApp send library set");
    } catch (e) {
      if (e.message.includes("LZ_SameValue")) {
        console.log("   ✅ OApp send library already set");
      } else {
        console.log("   ⚠️  OApp send library failed:", e.message);
      }
    }

    // Set receive library
    try {
      const tx6 = await endpoint.setReceiveLibrary(storyOft.address, 84532, storyInfra.receiveUln302, 0);
      await tx6.wait();
      console.log("   ✅ OApp receive library set");
    } catch (e) {
      if (e.message.includes("LZ_SameValue")) {
        console.log("   ✅ OApp receive library already set");
      } else {
        console.log("   ⚠️  OApp receive library failed:", e.message);
      }
    }
  } else {
    console.log("   ⚠️  Deployer is not OApp delegate");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Story Aeneid configuration complete!");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
