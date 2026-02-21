const hre = require("hardhat");
const fs = require("fs");

// Base Sepolia USDC (Circle testnet)
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🔒 Deploying OAppProxyOFT");
  console.log("   Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("   Deployer:", deployer.address);
  
  // Get endpoint address based on network
  let endpointAddress;
  let usdcAddress;
  
  if (network.chainId === 84532n) {
    // Base Sepolia - prefer self-deployed endpoint if available
    const selfDeployedEndpointFile = "deployments/base-sepolia-own-latest.json";
    if (fs.existsSync(selfDeployedEndpointFile)) {
      const selfDeployed = JSON.parse(fs.readFileSync(selfDeployedEndpointFile, "utf8"));
      endpointAddress = process.env.BASE_SEPOLIA_ENDPOINT || selfDeployed.endpointV2;
      console.log("   Using self-deployed endpoint:", endpointAddress);
    } else {
      endpointAddress = process.env.BASE_SEPOLIA_ENDPOINT || "0x6EDCE65403992e310A62460808c4b910D972f10f";
      console.log("   Using official LayerZero endpoint:", endpointAddress);
    }
    usdcAddress = BASE_SEPOLIA_USDC;
    console.log("   USDC:", usdcAddress);
    console.log("   Endpoint:", endpointAddress);
  } else if (network.chainId === 1315n) {
    // Story Aeneid - need wrapped USDC address
    endpointAddress = process.env.STORY_AENEID_ENDPOINT || "0xdB09C62692B837C6bd8E53dF33957E5f018A68B4";
    usdcAddress = process.env.STORY_AENEID_USDC || "0x0000000000000000000000000000000000000000";
    console.log("   Wrapped USDC:", usdcAddress);
    console.log("   Endpoint:", endpointAddress);
    
    if (usdcAddress === "0x0000000000000000000000000000000000000000") {
      console.error("❌ Error: STORY_AENEID_USDC not set. Deploy a wrapped USDC token first or set the address.");
      process.exit(1);
    }
  } else {
    console.error("❌ Unsupported network. Use Base Sepolia (84532) or Story Aeneid (1315)");
    process.exit(1);
  }
  
  const delegate = process.env.DELEGATE_ADDRESS || deployer.address;
  console.log("   Delegate:", delegate);
  
  const OAppProxyOFT = await hre.ethers.getContractFactory("OAppProxyOFT");
  const proxyOft = await OAppProxyOFT.deploy(usdcAddress, endpointAddress, delegate);
  await proxyOft.waitForDeployment();
  const address = await proxyOft.getAddress();
  
  const deployment = {
    chain: network.name,
    chainId: Number(network.chainId),
    oappProxyOft: address,
    wrappedToken: usdcAddress,
    endpoint: endpointAddress,
    delegate: delegate,
    deployedAt: new Date().toISOString(),
  };
  
  const filename = `deployments/oapp-proxy-oft-${network.name}-latest.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  
  console.log("\n✅ OAppProxyOFT deployed:", address);
  console.log("   Saved:", filename);
  console.log("   Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)\n");
  
  console.log("📝 Next steps:");
  console.log("   1. Set peers between Base Sepolia and Story Aeneid deployments");
  console.log("   2. Configure send/receive libraries");
  console.log("   3. Users must approve USDC to this contract before bridging");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
