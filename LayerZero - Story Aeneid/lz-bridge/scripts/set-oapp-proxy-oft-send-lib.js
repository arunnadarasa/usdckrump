/**
 * Set send library for OAppProxyOFT explicitly
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
  console.log("⚙️  Setting Send Library for OAppProxyOFT\n");
  console.log("Deployer:", deployer.address);

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("SendUln302:", ownEndpoint.sendUln302);
  console.log("Story Aeneid EID: 1315\n");

  // Check current library
  try {
    const [currentLib, isDefault] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
    console.log("Current library:", currentLib);
    console.log("Is default:", isDefault);
    
    if (currentLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("✅ Send library already set correctly!");
      return;
    }
  } catch (e) {
    console.log("Could not check current library:", e.message);
  }

  // Try setting as endpoint owner
  const endpointOwner = await endpoint.owner();
  console.log("Endpoint owner:", endpointOwner);
  console.log("Deployer:", deployer.address);
  console.log("Match:", endpointOwner.toLowerCase() === deployer.address.toLowerCase());

  if (endpointOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("\nSetting send library as endpoint owner...");
    try {
      const tx = await endpoint.setSendLibrary(proxyOftDeployment.oappProxyOft, 1315, ownEndpoint.sendUln302);
      await tx.wait();
      console.log("✅ Send library set!");
      
      // Verify
      const [newLib] = await endpoint.getSendLibrary(proxyOftDeployment.oappProxyOft, 1315);
      console.log("Verified library:", newLib);
    } catch (e) {
      console.error("❌ Failed:", e.message);
      if (e.data) {
        console.error("Error data:", e.data);
      }
      process.exit(1);
    }
  } else {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }
}

main().catch(console.error);
