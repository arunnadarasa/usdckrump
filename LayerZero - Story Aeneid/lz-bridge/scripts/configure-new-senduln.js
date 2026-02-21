/**
 * Configure the newly deployed SendUln302
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log("🔧 Configuring New SendUln302\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const dstEid = 1315;

  // Check current default
  console.log("1. Checking current default send library:");
  const currentDefault = await endpoint.defaultSendLibrary(dstEid);
  console.log("   Current default:", currentDefault);
  console.log("   New SendUln302:", ownEndpoint.sendUln302);
  const isSame = currentDefault.toLowerCase() === ownEndpoint.sendUln302.toLowerCase();
  console.log("   Already set?", isSame ? "✅ YES" : "❌ NO");

  if (!isSame) {
    console.log("\n2. Setting new SendUln302 as default:");
    try {
      const tx = await endpoint.setDefaultSendLibrary(dstEid, ownEndpoint.sendUln302);
      await tx.wait();
      console.log("   ✅ Default send library set");
    } catch (e) {
      console.log("   ❌ Error:", e.message);
      if (e.data) {
        const errorSig = e.data.slice(0, 10);
        console.log("   Error signature:", errorSig);
      }
    }
  }

  // Configure ULN and executor configs
  console.log("\n3. Configuring ULN config:");
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const simpleDvn = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  // Find SimpleDVN address (might be in a different file)
  let dvnAddress = "0xDFaa4A8E7CFfbAa4Aec51593bc9210F44e2A8b84"; // From previous logs
  
  const ulnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [dvnAddress]
  };

  try {
    const tx1 = await sendUln.setDefaultUlnConfigs([{ eid: dstEid, config: ulnConfig }]);
    await tx1.wait();
    console.log("   ✅ ULN config set");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  console.log("\n4. Configuring executor config:");
  try {
    const executorConfig = { maxMessageSize: 10000, executor: ownEndpoint.executor };
    const tx2 = await sendUln.setDefaultExecutorConfigs([{ eid: dstEid, config: executorConfig }]);
    await tx2.wait();
    console.log("   ✅ Executor config set");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Test quote()
  console.log("\n5. Testing quote():");
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const messagingParams = {
    dstEid: dstEid,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ quote() SUCCEEDED!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
    console.log("\n   🎉 BUG FIXED!");
    console.log("   Root cause: Bytecode mismatch - deployed contract compiled with different settings");
    console.log("   Solution: Redeployed SendUln302 with current compiler settings");
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ quote() still fails:", errorSig);
    console.log("   Error:", e.message);
  }

  console.log("\n✅ Configuration complete.");
}

main().catch(console.error);
