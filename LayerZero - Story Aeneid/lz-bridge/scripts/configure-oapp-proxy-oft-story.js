/**
 * Configure OAppProxyOFT libraries on Story Aeneid for Base Sepolia
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
  console.log("⚙️  Configuring OAppProxyOFT Libraries on Story Aeneid");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8"));
  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyInfra.endpointV2);
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", storyInfra.endpointV2);
  console.log("   SendUln302:", storyInfra.sendUln302);
  console.log("   ReceiveUln302:", storyInfra.receiveUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Base Sepolia EID: 40245\n");

  // Verify we're the OAppProxyOFT owner
  const oftOwner = await proxyOft.owner();
  const isOwner = oftOwner.toLowerCase() === deployer.address.toLowerCase();
  
  if (!isOwner) {
    console.error("❌ Not OAppProxyOFT owner!");
    console.log("   Owner:", oftOwner);
    process.exit(1);
  }
  console.log("✅ Verified as OAppProxyOFT owner\n");

  // Set send library for OAppProxyOFT → Base Sepolia
  console.log("Setting send library for OAppProxyOFT → Base Sepolia (EID 40245)...");
  try {
    const tx1 = await endpoint.setSendLibrary(proxyOftDeployment.oappProxyOft, 40245, storyInfra.sendUln302);
    await tx1.wait();
    console.log("   ✅ Send library configured");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }

  // Set receive library for Base Sepolia → Story Aeneid
  console.log("\nSetting receive library for Base Sepolia → Story Aeneid...");
  try {
    const tx2 = await endpoint.setReceiveLibrary(proxyOftDeployment.oappProxyOft, 40245, storyInfra.receiveUln302, 0);
    await tx2.wait();
    console.log("   ✅ Receive library configured");
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
