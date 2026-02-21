const hre = require("hardhat");
const fs = require("fs");

/**
 * Set OAppProxyOFT as delegate on the LayerZero endpoint
 * This allows OAppProxyOFT to configure its own libraries
 */
async function main() {
  console.log("🔐 Setting up OAppProxyOFT delegate\n");

  const network = await hre.ethers.provider.getNetwork();
  const [signer] = await hre.ethers.getSigners();

  // Load deployment
  const deployment = JSON.parse(
    fs.readFileSync(`deployments/oapp-proxy-oft-${network.name}-latest.json`, "utf8")
  );

  console.log("Network:", network.name);
  console.log("OAppProxyOFT:", deployment.oappProxyOft);
  console.log("Endpoint:", deployment.endpoint);
  console.log("Signer:", signer.address);

  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    deployment.endpoint
  );

  // Check current delegate status
  try {
    const currentDelegate = await endpoint.delegates(deployment.oappProxyOft);
    console.log("\n📋 Current delegate status:", currentDelegate);
    
    if (currentDelegate) {
      console.log("   ✅ OAppProxyOFT is already a delegate");
      console.log("   You can proceed with library configuration");
      return;
    }
  } catch (error) {
    console.log("   ⚠️  Could not check delegate status:", error.message);
  }

  // Set delegate
  console.log("\n🔐 Setting OAppProxyOFT as delegate...");
  try {
    const tx = await endpoint.setDelegate(deployment.oappProxyOft, true);
    await tx.wait();
    console.log("   ✅ Delegate set successfully!");
    console.log("\n📝 Next: Run configure:proxy-oft to set libraries");
  } catch (error) {
    console.log("   ❌ Failed to set delegate:", error.message);
    console.log("\n⚠️  This may require endpoint owner permissions.");
    console.log("   If you're not the endpoint owner, you may need to:");
    console.log("   1. Ask the endpoint owner to set the delegate");
    console.log("   2. Or configure libraries manually via endpoint owner");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
