/**
 * Use official LayerZero SendUln302 with self-deployed endpoint
 * This should fix the 0x6592671c error while keeping the self-deployed endpoint
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
  console.log("🔄 Switching to Official SendUln302 with Self-Deployed Endpoint");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Current Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2, "(self-deployed)");
  console.log("   SendUln302:", ownEndpoint.sendUln302, "(self-deployed - causing issues)");
  console.log("   Official SendUln302:", ownEndpoint.officialSendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  // Verify endpoint owner
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner! Cannot configure libraries.");
    console.log("   Endpoint owner:", endpointOwner);
    process.exit(1);
  }
  console.log("✅ Verified as endpoint owner\n");

  // Step 1: Register official SendUln302 if not already registered
  console.log("1/4 Registering official SendUln302...");
  const officialRegistered = await endpoint.isRegisteredLibrary(ownEndpoint.officialSendUln302);
  if (!officialRegistered) {
    try {
      const tx = await endpoint.registerLibrary(ownEndpoint.officialSendUln302);
      await tx.wait();
      console.log("   ✅ Official SendUln302 registered");
    } catch (e) {
      console.error("   ❌ Failed to register:", e.message);
      if (e.data) console.error("   Error data:", e.data);
      process.exit(1);
    }
  } else {
    console.log("   ✅ Official SendUln302 already registered");
  }

  // Step 2: Set official SendUln302 as default for Story Aeneid
  console.log("\n2/4 Setting official SendUln302 as default for EID 1315...");
  try {
    const tx = await endpoint.setDefaultSendLibrary(1315, ownEndpoint.officialSendUln302);
    await tx.wait();
    console.log("   ✅ Default send library set to official SendUln302");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  // Step 3: Set official SendUln302 as per-OApp library
  console.log("\n3/4 Setting official SendUln302 for OAppProxyOFT...");
  try {
    const tx = await endpoint.setSendLibrary(
      proxyOftDeployment.oappProxyOft,
      1315,
      ownEndpoint.officialSendUln302
    );
    await tx.wait();
    console.log("   ✅ Per-OApp send library set to official SendUln302");
  } catch (e) {
    console.log("   ⚠️  Per-OApp setting failed:", e.message);
    console.log("   (Default library will be used instead)");
  }

  // Step 4: Test quoteSend
  console.log("\n4/4 Testing quoteSend with official SendUln302...");
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  const sendParam = {
    dstEid: 1315,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("\n   🎉 Using official SendUln302 fixed the issue!");
    console.log("\n   📝 Note: You're still using the self-deployed endpoint,");
    console.log("      but with the official LayerZero SendUln302 library.");
  } catch (error) {
    console.log("   ❌ quoteSend still failed:", error.message);
    if (error.data) {
      const errorSig = error.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
    console.log("\n   ⚠️  Issue persists even with official SendUln302");
    console.log("   This suggests the problem might be elsewhere.");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Configuration updated!");
  console.log("=".repeat(60));
  console.log("\n📝 Summary:");
  console.log("   - Endpoint: Self-deployed ✅");
  console.log("   - SendUln302: Official LayerZero ✅");
  console.log("   - This hybrid approach should work!");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
