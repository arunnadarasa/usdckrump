/**
 * Test DVN.getFee() directly to see if it's causing the failure
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
  console.log("🧪 Testing DVN.getFee() Directly");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));
  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  const dstEid = 1315;

  // Get ULN config
  console.log("1. Getting ULN config...");
  const ulnConfigBytes = await sendUln.getConfig(dstEid, proxyOftDeployment.oappProxyOft, 2);
  const ulnConfig = hre.ethers.AbiCoder.defaultAbiCoder().decode(
    ["tuple(uint64,uint16,uint16,uint16,address[],address[])"],
    ulnConfigBytes
  )[0];

  console.log("   Confirmations:", ulnConfig[0].toString());
  console.log("   Optional DVNs:", ulnConfig[5].length);
  if (ulnConfig[5].length > 0) {
    console.log("   DVN address:", ulnConfig[5][0]);
  }

  // Test DVN.getFee()
  if (ulnConfig[5].length > 0) {
    const dvn = ulnConfig[5][0];
    console.log("\n2. Testing DVN.getFee()...");
    console.log("   DVN:", dvn);
    console.log("   This is Story Aeneid's ReceiveUln302");
    
    try {
      const ILayerZeroDVN = new hre.ethers.Interface([
        "function getFee(uint32 dstEid, uint64 confirmations, address sender, bytes calldata options) external view returns (uint256)"
      ]);
      const dvnContract = new hre.ethers.Contract(dvn, ILayerZeroDVN, hre.ethers.provider);
      
      console.log("   Calling getFee...");
      const dvnFee = await dvnContract.getFee.staticCall(
        dstEid,
        ulnConfig[0], // confirmations
        proxyOftDeployment.oappProxyOft, // sender
        "0x" // options
      );
      
      console.log("   ✅ DVN.getFee SUCCESS!");
      console.log("   Fee:", hre.ethers.formatEther(dvnFee), "ETH");
    } catch (e) {
      const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
      console.log("   ❌ DVN.getFee FAILED!");
      console.log("   Error:", e.message);
      console.log("   Error signature:", errorSig);
      if (e.data) {
        console.log("   Error data:", e.data);
      }
      
      // Check if ReceiveUln302 implements ILayerZeroDVN
      console.log("\n   💡 This DVN is Story Aeneid's ReceiveUln302");
      console.log("   ReceiveUln302 might not implement ILayerZeroDVN.getFee()");
      console.log("   This could be the root cause of the failure!");
    }
  } else {
    console.log("\n   ⚠️  No DVNs configured");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test complete");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
