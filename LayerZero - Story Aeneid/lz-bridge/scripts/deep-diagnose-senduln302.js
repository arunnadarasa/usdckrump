/**
 * Deep diagnostic for SendUln302 configuration
 * Checks all aspects that could cause quoteSend to fail
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
  console.log("🔍 Deep SendUln302 Diagnostic");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  const dstEid = 1315;
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  console.log("📋 Configuration Check:\n");

  // Check 1: Is SendUln302 registered?
  console.log("1. Checking SendUln302 registration...");
  const isRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  console.log("   Registered:", isRegistered ? "✅ YES" : "❌ NO");

  // Check 2: Is SendUln302 set as default send library?
  console.log("\n2. Checking default send library...");
  const defaultLib = await endpoint.defaultSendLibrary(dstEid);
  console.log("   Default library:", defaultLib);
  console.log("   Matches SendUln302:", defaultLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅ YES" : "❌ NO");

  // Check 3: Is SendUln302 set as per-OApp send library?
  console.log("\n3. Checking per-OApp send library...");
  try {
    const [oappLib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, dstEid);
    console.log("   OApp library:", oappLib);
    console.log("   Is default:", isDefault ? "YES (using default)" : "NO (per-OApp)");
    console.log("   Matches SendUln302:", oappLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (e) {
    console.log("   ❌ Failed to get:", e.message);
  }

  // Check 4: Does SendUln302 support EID 1315?
  console.log("\n4. Checking EID support...");
  const supportsEid = await sendUln.isSupportedEid(dstEid);
  console.log("   Supports EID 1315:", supportsEid ? "✅ YES" : "❌ NO");

  // Check 5: Get ULN config
  console.log("\n5. Checking ULN configuration...");
  try {
    const config = await endpoint.getConfig(proxyOftDeployment.oappProxyOft, dstEid, 2); // CONFIG_TYPE_ULN
    console.log("   ULN Config:", config);
    if (config && config !== "0x") {
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["tuple(uint64,uint16,uint16,uint16,address[],address[])"],
        config
      );
      console.log("   Decoded:", {
        confirmations: decoded[0][0].toString(),
        requiredDVNCount: decoded[0][1].toString(),
        optionalDVNCount: decoded[0][2].toString(),
        optionalDVNThreshold: decoded[0][3].toString(),
        requiredDVNs: decoded[0][4],
        optionalDVNs: decoded[0][5]
      });
    }
  } catch (e) {
    console.log("   ❌ Failed to get ULN config:", e.message);
  }

  // Check 6: Get Executor config
  console.log("\n6. Checking Executor configuration...");
  try {
    const executorConfig = await endpoint.getConfig(proxyOftDeployment.oappProxyOft, dstEid, 1); // CONFIG_TYPE_EXECUTOR
    console.log("   Executor Config:", executorConfig);
    if (executorConfig && executorConfig !== "0x") {
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["tuple(address,uint64)"],
        executorConfig
      );
      console.log("   Decoded:", {
        executor: decoded[0][0],
        maxMessageSize: decoded[0][1].toString()
      });
    }
  } catch (e) {
    console.log("   ❌ Failed to get Executor config:", e.message);
  }

  // Check 7: Try calling quote directly on endpoint
  console.log("\n7. Testing endpoint.quote() directly...");
  try {
    // Create minimal Type 3 options
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17;
    const GAS = 0n;
    
    const minimalType3 = hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );

    const quoteParams = {
      dstEid: dstEid,
      sender: proxyOftDeployment.oappProxyOft,
      value: 0n,
      options: minimalType3,
      payInLzToken: false
    };

    const [nativeFee, lzTokenFee] = await endpoint.quote(quoteParams);
    console.log("   ✅ endpoint.quote() SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ Token Fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ endpoint.quote() failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    if (error.data) {
      console.log("   Full error data:", error.data);
    }
  }

  // Check 8: Try calling quote on SendUln302 directly
  console.log("\n8. Testing SendUln302.quote() directly...");
  try {
    const minimalType3 = hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [3, 1, 17, 1, 0n]
    );

    const quoteParams = {
      dstEid: dstEid,
      sender: proxyOftDeployment.oappProxyOft,
      value: 0n,
      options: minimalType3,
      payInLzToken: false
    };

    const [nativeFee, lzTokenFee] = await sendUln.quote(quoteParams);
    console.log("   ✅ SendUln302.quote() SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ Token Fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ SendUln302.quote() failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    if (error.data) {
      console.log("   Full error data:", error.data);
      if (error.data.length > 10) {
        console.log("   Error data (hex):", error.data);
      }
    }
    if (error.reason) {
      console.log("   Error reason:", error.reason);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Diagnostic Summary");
  console.log("=".repeat(60));
  console.log("\nIf endpoint.quote() works but SendUln302.quote() fails:");
  console.log("→ Issue is in SendUln302 implementation");
  console.log("\nIf both fail:");
  console.log("→ Issue is in configuration or library assignment");
  console.log("\nIf SendUln302.quote() works but proxyOft.quoteSend() fails:");
  console.log("→ Issue is in how proxyOft calls the endpoint");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  console.error(e);
  process.exit(1);
});
