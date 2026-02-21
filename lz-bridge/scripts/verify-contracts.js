const hre = require("hardhat");
const fs = require("fs");

/**
 * Automated contract verification script for Story Aeneid
 * Uses Hardhat's verify plugin with Blockscout API
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script is for Story Aeneid (Chain ID 1315) only");
    process.exit(1);
  }

  console.log("🔍 Verifying contracts on StoryScan (Blockscout)...\n");
  console.log("=".repeat(60));

  // Load deployments
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/story-aeneid-latest.json', 'utf8')
  );
  
  const usdcDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );

  const deployer = storyDeployment.deployer;

  console.log("\n1️⃣ Verifying EndpointV2...");
  try {
    await hre.run("verify:verify", {
      address: storyDeployment.endpointV2,
      constructorArguments: [1315, deployer], // _eid, _owner
      network: "storyAeneid"
    });
    console.log("   ✅ EndpointV2 verified\n");
  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
      console.log("   ⚠️  EndpointV2 already verified\n");
    } else {
      console.log(`   ❌ EndpointV2 verification failed: ${error.message}\n`);
    }
  }

  console.log("2️⃣ Verifying SendUln302...");
  try {
    await hre.run("verify:verify", {
      address: storyDeployment.sendUln302,
      constructorArguments: [
        storyDeployment.endpointV2,
        50000, // _treasuryGasLimit
        "1000000000000000000" // _treasuryGasForFeeCap (1 IP in wei)
      ],
      network: "storyAeneid"
    });
    console.log("   ✅ SendUln302 verified\n");
  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
      console.log("   ⚠️  SendUln302 already verified\n");
    } else {
      console.log(`   ❌ SendUln302 verification failed: ${error.message}\n`);
    }
  }

  console.log("3️⃣ Verifying ReceiveUln302...");
  try {
    await hre.run("verify:verify", {
      address: storyDeployment.receiveUln302,
      constructorArguments: [storyDeployment.endpointV2], // _endpoint
      network: "storyAeneid"
    });
    console.log("   ✅ ReceiveUln302 verified\n");
  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
      console.log("   ⚠️  ReceiveUln302 already verified\n");
    } else {
      console.log(`   ❌ ReceiveUln302 verification failed: ${error.message}\n`);
    }
  }

  console.log("4️⃣ Verifying USDCDanceOFT...");
  try {
    await hre.run("verify:verify", {
      address: usdcDeployment.address,
      constructorArguments: [
        usdcDeployment.endpoint, // _endpoint
        deployer, // _delegate
        usdcDeployment.backend // _backend
      ],
      network: "storyAeneid"
    });
    console.log("   ✅ USDCDanceOFT verified\n");
  } catch (error) {
    if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
      console.log("   ⚠️  USDCDanceOFT already verified\n");
    } else {
      console.log(`   ❌ USDCDanceOFT verification failed: ${error.message}\n`);
    }
  }

  // Check if EVVM adapter is deployed
  let evvmAdapterDeployment = null;
  try {
    evvmAdapterDeployment = JSON.parse(
      fs.readFileSync('deployments/storyAeneid-evvm-adapter-latest.json', 'utf8')
    );
  } catch (e) {
    // EVVM adapter not deployed yet
  }

  if (evvmAdapterDeployment) {
    console.log("5️⃣ Verifying EVVMPaymentAdapter...");
    try {
      await hre.run("verify:verify", {
        address: evvmAdapterDeployment.address,
        constructorArguments: [
          evvmAdapterDeployment.constructorArgs.usdcDance,
          evvmAdapterDeployment.constructorArgs.evvmCore,
          evvmAdapterDeployment.constructorArgs.evvmId,
          evvmAdapterDeployment.constructorArgs.owner
        ],
        network: "storyAeneid"
      });
      console.log("   ✅ EVVMPaymentAdapter verified\n");
    } catch (error) {
      if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
        console.log("   ⚠️  EVVMPaymentAdapter already verified\n");
      } else {
        console.log(`   ❌ EVVMPaymentAdapter verification failed: ${error.message}\n`);
      }
    }
  }

  console.log("=".repeat(60));
  console.log("\n✅ Verification complete!");
  console.log("\n🔗 View verified contracts:");
  console.log(`   EndpointV2:         https://aeneid.storyscan.io/address/${storyDeployment.endpointV2}#code`);
  console.log(`   SendUln302:         https://aeneid.storyscan.io/address/${storyDeployment.sendUln302}#code`);
  console.log(`   ReceiveUln302:      https://aeneid.storyscan.io/address/${storyDeployment.receiveUln302}#code`);
  console.log(`   USDCDanceOFT:       https://aeneid.storyscan.io/address/${usdcDeployment.address}#code`);
  if (evvmAdapterDeployment) {
    console.log(`   EVVMPaymentAdapter: https://aeneid.storyscan.io/address/${evvmAdapterDeployment.address}#code`);
  }
  console.log("\n");
}

main().catch((error) => {
  console.error("❌ Verification error:", error);
  process.exit(1);
});
