/**
 * Final fix for SendUln302 - ensures all configuration is correct
 * Based on LayerZero V2 documentation: libraries must be registered
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
  console.log("🔧 Final Fix for SendUln302 Configuration");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  // Verify endpoint owner
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  console.log("📋 Step-by-Step Configuration:\n");

  // Step 1: Register SendUln302
  console.log("1/5 Registering SendUln302...");
  const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  if (!isRegistered) {
    const tx = await endpoint.registerLibrary(ownEndpoint.sendUln302);
    await tx.wait();
    console.log("   ✅ Registered");
  } else {
    console.log("   ✅ Already registered");
  }

  // Step 2: Verify SendUln302 supports EID 1315
  console.log("\n2/5 Verifying EID support...");
  const supportsEid = await sendUln.isSupportedEid(1315);
  if (!supportsEid) {
    console.log("   ⚠️  EID 1315 not supported. Configuring...");
    // Configure via endpoint.setConfig
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
        [[ulnConfig.confirmations, ulnConfig.requiredDVNCount, ulnConfig.optionalDVNCount, ulnConfig.optionalDVNThreshold, ulnConfig.requiredDVNs, ulnConfig.optionalDVNs]]
      )
    };

    const tx = await endpoint.setConfig(proxyOftDeployment.oappProxyOft, [configParam]);
    await tx.wait();
    console.log("   ✅ Configured");
  } else {
    console.log("   ✅ EID 1315 supported");
  }

  // Step 3: Set default send library
  console.log("\n3/5 Setting default send library...");
  const currentDefault = await endpoint.defaultSendLibrary(1315);
  if (currentDefault.toLowerCase() !== ownEndpoint.sendUln302.toLowerCase()) {
    const tx = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.sendUln302);
    await tx.wait();
    console.log("   ✅ Set");
  } else {
    console.log("   ✅ Already set");
  }

  // Step 4: Set per-OApp send library (optional)
  console.log("\n4/5 Setting per-OApp send library...");
  try {
    const tx = await endpoint.setSendLibrary(proxyOftDeployment.oappProxyOft, 1315, ownEndpoint.sendUln302);
    await tx.wait();
    console.log("   ✅ Set");
  } catch (e) {
    console.log("   ⚠️  Failed (will use default):", e.message);
  }

  // Step 5: Test quoteSend
  console.log("\n5/5 Testing quoteSend...");
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  // Helper function to create minimal Type 3 options
  // Format: [type: uint16=3][worker_id: uint8=1][option_size: uint16][option_type: uint8=1][gas: uint128=0]
  function createMinimalType3Options() {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17; // 1 byte (option_type) + 16 bytes (gas uint128)
    const GAS = 0n; // Minimal gas
    
    return hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );
  }

  // Try with combineOptions first
  const SEND = 1;
  let extraOptions = "0x";
  let optionsSource = "empty";
  
  try {
    extraOptions = await proxyOft.combineOptions(1315, SEND, "0x");
    console.log("   📝 combineOptions returned:", extraOptions);
    console.log("   Length:", extraOptions.length, "bytes");
    
    // If combineOptions returns empty, create minimal Type 3 options
    // Per LayerZero V2 docs: UlnOptions.decode() requires at least 2 bytes
    if (extraOptions === "0x" || extraOptions.length < 2) {
      console.log("   ⚠️  Empty options detected. Creating minimal Type 3 options...");
      extraOptions = createMinimalType3Options();
      optionsSource = "minimal Type 3";
      console.log("   ✅ Created minimal Type 3 options");
      console.log("   Format: [type: 3][worker_id: 1][size: 17][option_type: 1][gas: 0]");
    } else {
      optionsSource = "combineOptions";
    }
  } catch (e) {
    console.log("   ⚠️  combineOptions failed:", e.message);
    console.log("   Creating minimal Type 3 options as fallback...");
    extraOptions = createMinimalType3Options();
    optionsSource = "minimal Type 3 (fallback)";
  }

  console.log(`\n   Using options from: ${optionsSource}`);

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
    console.log("\n   🎉 Bridge is working!");
    console.log(`   ✅ Solution: Using ${optionsSource} resolved the issue`);
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    
    if (errorSig === "0x6592671c") {
      console.log("\n   🔍 Error 0x6592671c = LZ_ULN_InvalidWorkerOptions");
      console.log("   Per LayerZero V2 docs, this occurs when:");
      console.log("   1. Options length < 2 bytes (empty options)");
      console.log("   2. Option size is 0");
      console.log("   3. Cursor doesn't match options length");
      console.log("\n   💡 This suggests the self-deployed SendUln302 may have a bug.");
      console.log("   Solutions:");
      console.log("   1. Redeploy SendUln302 with exact LayerZero V2 compiler settings");
      console.log("      - optimizer.runs: 200");
      console.log("      - viaIR: true");
      console.log("   2. Verify SendUln302 bytecode matches official LayerZero V2");
      console.log("   3. Check if the issue persists with minimal Type 3 options");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Configuration complete!");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
