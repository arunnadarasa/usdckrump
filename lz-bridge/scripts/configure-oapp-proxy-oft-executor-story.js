/**
 * Configure executor settings for OAppProxyOFT on Story Aeneid
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
  console.log("⚙️  Configuring Executor Settings for OAppProxyOFT");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   EndpointV2:", storyInfra.endpointV2);
  console.log("   SendUln302:", storyInfra.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Base Sepolia Executor:", baseEndpoint.executor || "None");
  console.log("   Base Sepolia EID: 40245\n");

  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyInfra.endpointV2);
  
  // Configure Executor settings via SendUln302
  console.log("Configuring Executor settings for OAppProxyOFT → Base Sepolia...");
  if (baseEndpoint.executor && baseEndpoint.executor !== "0x0000000000000000000000000000000000000000") {
    const executorConfig = {
      executor: baseEndpoint.executor,
      lzReceiveOption: {
        gas: 200000,
        value: 0
      }
    };

    const executorConfigParam = {
      eid: 40245,
      configType: 1, // CONFIG_TYPE_EXECUTOR
      config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address executor, tuple(uint128 gas, uint128 value) lzReceiveOption)"],
        [executorConfig]
      )
    };

    try {
      const tx = await endpoint.setConfig(
        proxyOftDeployment.oappProxyOft,
        storyInfra.sendUln302,
        [executorConfigParam]
      );
      await tx.wait();
      console.log("   ✅ Executor configured");
    } catch (e) {
      console.log("   ⚠️  Executor config failed:", e.message);
      console.log("   This is OK - messages can still be executed via executor worker");
    }
  } else {
    console.log("   ⚠️  No executor deployed (using executor worker instead)");
  }

  console.log("\n✅ Configuration complete");
}

main().catch((e) => {
  console.error("❌ Configuration failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
