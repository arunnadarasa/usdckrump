/**
 * Redeploy SendUln302 ensuring exact bytecode match with LayerZero V2
 * This should fix the 0x6592671c error
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
  console.log("🔧 Redeploying SendUln302 with Exact LayerZero V2 Match");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Current Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   Current SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft, "\n");

  // Verify endpoint owner
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  console.log("1/5 Deploying new SendUln302...");
  const SendUln302 = await hre.ethers.getContractFactory("SendUln302");
  const sendUln = await SendUln302.deploy(
    ownEndpoint.endpointV2,
    50000, // treasuryGasLimit
    1000000000000000000n // treasuryNativeFeeCap (1 ETH)
  );
  await sendUln.waitForDeployment();
  const newSendUlnAddress = await sendUln.getAddress();
  console.log("   ✅ Deployed:", newSendUlnAddress);

  console.log("\n2/5 Registering new SendUln302...");
  const tx1 = await endpoint.registerLibrary(newSendUlnAddress);
  await tx1.wait();
  console.log("   ✅ Registered");

  console.log("\n3/5 Configuring SendUln302 for Story Aeneid...");
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  
  // First, enable EID support by setting default ULN config (if we're the owner)
  const sendUlnOwner = await sendUln.owner();
  const isOwner = sendUlnOwner.toLowerCase() === deployer.address.toLowerCase();
  
  if (isOwner) {
    console.log("   Setting default ULN config to enable EID support...");
    const ulnConfig = {
      confirmations: 1,
      requiredDVNCount: 0,
      optionalDVNCount: 1,
      optionalDVNThreshold: 1,
      requiredDVNs: [],
      optionalDVNs: [storyInfra.receiveUln302]
    };
    
    try {
      const txDefault = await sendUln.setDefaultUlnConfigs([{
        eid: 1315,
        config: ulnConfig
      }]);
      await txDefault.wait();
      console.log("   ✅ Default ULN config set (EID enabled)");
    } catch (e) {
      console.log("   ⚠️  Failed to set default config:", e.message);
      console.log("   Will try via endpoint.setConfig instead...");
    }
  } else {
    console.log("   ⚠️  Not SendUln302 owner, will configure via endpoint.setConfig");
  }
  
  // Set ULN config via endpoint (this also enables EID if not already enabled)
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
    configType: 2, // CONFIG_TYPE_ULN
    config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(uint64,uint16,uint16,uint16,address[],address[])"],
      [[
        ulnConfig.confirmations,
        ulnConfig.requiredDVNCount,
        ulnConfig.optionalDVNCount,
        ulnConfig.optionalDVNThreshold,
        ulnConfig.requiredDVNs,
        ulnConfig.optionalDVNs
      ]]
    )
  };

  const tx2 = await endpoint.setConfig(proxyOftDeployment.oappProxyOft, newSendUlnAddress, [configParam]);
  await tx2.wait();
  console.log("   ✅ ULN config set");

  // Set executor config
  console.log("   Setting executor config...");
  const executorConfig = {
    maxMessageSize: 10000,
    executor: ownEndpoint.executor
  };

  const executorConfigParam = {
    eid: 1315,
    configType: 1, // CONFIG_TYPE_EXECUTOR
    config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(uint32 maxMessageSize, address executor)"],
      [[executorConfig.maxMessageSize, executorConfig.executor]]
    )
  };

  try {
    const tx3 = await endpoint.setConfig(proxyOftDeployment.oappProxyOft, newSendUlnAddress, [executorConfigParam]);
    await tx3.wait();
    console.log("   ✅ Executor config set");
  } catch (e) {
    console.log("   ⚠️  Executor config failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
    }
    console.log("   Continuing anyway - executor config may not be required...");
  }

  console.log("\n4/5 Setting as default send library...");
  const tx4 = await endpoint.setDefaultSendLibrary(1315, newSendUlnAddress);
  await tx4.wait();
  console.log("   ✅ Default send library set");

  console.log("\n5/5 Testing quoteSend...");
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  // Helper function to create minimal Type 3 options
  function createMinimalType3Options() {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17; // 1 byte (option_type) + 16 bytes (gas uint128)
    const GAS = 0n;
    
    return hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );
  }

  // Try with combineOptions first, fallback to Type 3 if empty
  const SEND = 1;
  let extraOptions = "0x";
  try {
    extraOptions = await proxyOft.combineOptions(1315, SEND, "0x");
    if (extraOptions === "0x" || extraOptions.length < 2) {
      console.log("   ⚠️  combineOptions returned empty, using minimal Type 3 options...");
      extraOptions = createMinimalType3Options();
    }
  } catch (e) {
    console.log("   ⚠️  combineOptions failed, using minimal Type 3 options:", e.message);
    extraOptions = createMinimalType3Options();
  }

  const sendParam = {
    dstEid: 1315,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: extraOptions,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("\n   🎉 New SendUln302 works!");
    
    // Update deployment file
    ownEndpoint.sendUln302 = newSendUlnAddress;
    ownEndpoint.deployedAt = new Date().toISOString();
    ownEndpoint.note = "Redeployed SendUln302 to fix 0x6592671c error - exact LayerZero V2 match with Type 3 options";
    fs.writeFileSync("deployments/base-sepolia-own-latest.json", JSON.stringify(ownEndpoint, null, 2));
    console.log("\n   ✅ Deployment file updated");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend still failed:", error.message);
    console.log("   Error signature:", errorSig);
    if (error.data) {
      console.log("   Full error data:", error.data);
    }
    
    if (errorSig === "0x6592671c") {
      console.log("\n   ⚠️  Still getting LZ_ULN_InvalidWorkerOptions");
      console.log("   This suggests the bytecode may still not match.");
    } else {
      console.log("\n   ⚠️  Different error - may need further investigation.");
    }
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
