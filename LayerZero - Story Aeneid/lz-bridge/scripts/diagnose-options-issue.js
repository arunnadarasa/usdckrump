/**
 * Comprehensive diagnostic script for 0x6592671c error
 * Based on LayerZero V2 documentation insights
 * Tests multiple option formats to identify the root cause
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
  console.log("🔍 Comprehensive Options Diagnostic");
  console.log("=".repeat(60));
  console.log("Based on LayerZero V2 Documentation");
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);
  const SEND = 1;
  const dstEid = 1315;

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Destination EID:", dstEid, "\n");

  // Test 1: Check combineOptions with empty input
  console.log("=".repeat(60));
  console.log("Test 1: Checking combineOptions behavior");
  console.log("=".repeat(60));
  try {
    const combinedEmpty = await proxyOft.combineOptions(dstEid, SEND, "0x");
    console.log("   combineOptions('0x'):", combinedEmpty);
    console.log("   Length:", combinedEmpty.length, "bytes");
    if (combinedEmpty === "0x" || combinedEmpty.length < 2) {
      console.log("   ⚠️  Returns empty - this will cause LZ_ULN_InvalidWorkerOptions!");
      console.log("   Reason: UlnOptions.decode() requires at least 2 bytes");
    } else {
      console.log("   ✅ Returns valid options");
    }
  } catch (e) {
    console.log("   ❌ combineOptions failed:", e.message);
  }

  // Test 2: Create minimal Type 3 options
  console.log("\n" + "=".repeat(60));
  console.log("Test 2: Creating minimal Type 3 options");
  console.log("=".repeat(60));
  const TYPE_3 = 3;
  const WORKER_ID_EXECUTOR = 1;
  const OPTION_TYPE_LZRECEIVE = 1;
  const OPTION_SIZE = 17; // 1 byte (option_type) + 16 bytes (gas uint128)
  const GAS = 0n;

  const minimalType3 = hre.ethers.solidityPacked(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
  );
  console.log("   Format: [type: 3][worker_id: 1][size: 17][option_type: 1][gas: 0]");
  console.log("   Encoded:", minimalType3);
  console.log("   Length:", minimalType3.length, "bytes");
  console.log("   ✅ Valid Type 3 options created");

  // Test 3: Check combineOptions with minimal Type 3
  console.log("\n" + "=".repeat(60));
  console.log("Test 3: combineOptions with minimal Type 3");
  console.log("=".repeat(60));
  try {
    const combinedType3 = await proxyOft.combineOptions(dstEid, SEND, minimalType3);
    console.log("   combineOptions(minimalType3):", combinedType3);
    console.log("   Length:", combinedType3.length, "bytes");
    console.log("   ✅ Successfully combined");
  } catch (e) {
    console.log("   ❌ combineOptions failed:", e.message);
  }

  // Test 4: Test quoteSend with empty options
  console.log("\n" + "=".repeat(60));
  console.log("Test 4: quoteSend with empty options");
  console.log("=".repeat(60));
  const sendParamEmpty = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFeeEmpty] = await proxyOft.quoteSend(sendParamEmpty, false);
    console.log("   ✅ quoteSend SUCCESS with empty options!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFeeEmpty), "ETH");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend failed");
    console.log("   Error signature:", errorSig);
    if (errorSig === "0x6592671c") {
      console.log("   ✅ Confirmed: Empty options cause LZ_ULN_InvalidWorkerOptions");
    }
  }

  // Test 5: Test quoteSend with minimal Type 3 options
  console.log("\n" + "=".repeat(60));
  console.log("Test 5: quoteSend with minimal Type 3 options");
  console.log("=".repeat(60));
  const sendParamType3 = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: minimalType3,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFeeType3] = await proxyOft.quoteSend(sendParamType3, false);
    console.log("   ✅ quoteSend SUCCESS with Type 3 options!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFeeType3), "ETH");
    console.log("\n   🎉 SOLUTION FOUND: Use minimal Type 3 options instead of empty!");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend still failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    if (error.data) {
      console.log("   Full error data:", error.data);
      if (error.data.length > 10) {
        const errorData = error.data.slice(10);
        console.log("   Error data (after signature):", errorData);
      }
    }
    if (error.reason) {
      console.log("   Error reason:", error.reason);
    }
    
    if (errorSig === "0x6592671c") {
      console.log("\n   ⚠️  Issue persists even with Type 3 options!");
      console.log("   This suggests a deeper issue with SendUln302:");
      console.log("   1. Bytecode mismatch with official LayerZero V2");
      console.log("   2. Compiler settings mismatch");
      console.log("   3. Bug in self-deployed SendUln302");
    } else if (errorSig === "unknown") {
      console.log("\n   ⚠️  Unknown error - need more details");
      console.log("   This might be:");
      console.log("   1. A different error in SendUln302");
      console.log("   2. A configuration issue");
      console.log("   3. A library assignment problem");
    }
  }

  // Test 6: Test quoteSend with combineOptions result
  console.log("\n" + "=".repeat(60));
  console.log("Test 6: quoteSend with combineOptions result");
  console.log("=".repeat(60));
  try {
    let combinedOptions = await proxyOft.combineOptions(dstEid, SEND, "0x");
    
    // If empty, use minimal Type 3
    if (combinedOptions === "0x" || combinedOptions.length < 2) {
      console.log("   combineOptions returned empty, using minimal Type 3...");
      combinedOptions = minimalType3;
    }
    
    const sendParamCombined = {
      dstEid: dstEid,
      to: recipient,
      amountLD: amount,
      minAmountLD: amount,
      extraOptions: combinedOptions,
      composeMsg: "0x",
      oftCmd: "0x",
    };

    const [nativeFeeCombined] = await proxyOft.quoteSend(sendParamCombined, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFeeCombined), "ETH");
    console.log("\n   🎉 SOLUTION: Use combineOptions with fallback to Type 3!");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend failed");
    console.log("   Error signature:", errorSig);
    console.log("   Error:", error.message);
    if (error.data) {
      console.log("   Full error data:", error.data);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Diagnostic Summary");
  console.log("=".repeat(60));
  console.log("\nBased on LayerZero V2 documentation:");
  console.log("• LZ_ULN_InvalidWorkerOptions occurs when options are malformed");
  console.log("• UlnOptions.decode() requires at least 2 bytes (the type)");
  console.log("• Empty options ('0x') will trigger this error");
  console.log("• Solution: Always use valid Type 3 options, even if minimal");
  console.log("\nNext steps:");
  console.log("1. If Type 3 options work: Update scripts to use them");
  console.log("2. If Type 3 options fail: Redeploy SendUln302 with correct compiler settings");
  console.log("   - optimizer.runs: 200");
  console.log("   - viaIR: true");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
