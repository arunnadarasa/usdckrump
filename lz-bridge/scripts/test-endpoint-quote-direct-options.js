/**
 * Test EndpointV2.quote() directly with different option formats
 * This helps identify the correct option encoding for self-deployed SendUln302
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("🧪 Testing EndpointV2.quote() with Different Option Formats");
  console.log("=".repeat(60));
  console.log("Deployer:", signer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  const recipient = hre.ethers.zeroPadValue(signer.address, 32);
  const message = "0x"; // Empty message for OFT

  // Test different option formats
  const testCases = [
    {
      name: "Completely empty (0x)",
      options: "0x",
    },
    {
      name: "Type 3 with empty executor options",
      options: "0x0003010000", // Type 3, executor worker (1), empty options
    },
    {
      name: "Type 3 with executor options (extraGas)",
      options: "0x00030100000000000000000000000000000000000000000000000000000000000000c350", // extraGas = 50000
    },
    {
      name: "Using combineOptions from OFT",
      options: null, // Will be set using combineOptions
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log("-".repeat(40));

    let options = testCase.options;
    if (options === null) {
      // Use combineOptions
      try {
        const SEND = 1;
        options = await proxyOft.combineOptions(1315, SEND, "0x");
        console.log("   Options from combineOptions:", options);
      } catch (e) {
        console.log("   ❌ combineOptions failed:", e.message);
        continue;
      }
    } else {
      console.log("   Options:", options);
    }

    const messagingParams = {
      dstEid: 1315,
      receiver: recipient,
      message: message,
      options: options,
      payInLzToken: false,
    };

    try {
      const fee = await endpoint.quote(messagingParams, proxyOftDeployment.oappProxyOft);
      console.log("   ✅ quote() SUCCESS!");
      console.log("   Native Fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      console.log("   LZ Token Fee:", hre.ethers.formatEther(fee.lzTokenFee), "LZ");
      console.log("\n   🎉 This option format works!");
      return; // Found working format
    } catch (error) {
      const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() failed");
      console.log("   Error:", error.message);
      console.log("   Error signature:", errorSig);
      if (error.data && error.data.length > 10) {
        const cursor = hre.ethers.dataSlice(error.data, 4);
        console.log("   Cursor (where parsing failed):", cursor);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("❌ None of the option formats worked");
  console.log("=".repeat(60));
  console.log("\n💡 Possible solutions:");
  console.log("   1. Verify SendUln302 bytecode matches LayerZero V2 exactly");
  console.log("   2. Check if SendUln302 needs specific option format");
  console.log("   3. Consider using official LayerZero SendUln302 instead");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
