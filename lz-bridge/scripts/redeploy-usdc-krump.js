const hre = require("hardhat");
const fs = require("fs");

/**
 * Redeployment script for USDC Krump (USDC.k) rebranding
 * 
 * This script:
 * 1. Deploys new WrappedUSDC contract with "USDC Krump" / "USDC.k" branding
 * 2. Deploys new OAppProxyOFT on Story Aeneid pointing to new WrappedUSDC
 * 3. Links peers between Base Sepolia and Story Aeneid
 * 4. Provides instructions for updating frontend config
 */

async function main() {
  console.log("🚀 USDC Krump Redeployment Script");
  console.log("===================================\n");

  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();

  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  console.log("");

  if (network.chainId !== 1315n) {
    console.error("❌ Error: This script must be run on Story Aeneid (Chain ID: 1315)");
    console.log("   Run: npm run redeploy:usdc-krump -- --network storyAeneid");
    process.exit(1);
  }

  // Step 1: Deploy new WrappedUSDC
  console.log("📦 Step 1: Deploying new WrappedUSDC (USDC Krump / USDC.k)...");
  const initialSupply = process.env.WRAPPED_USDC_INITIAL_SUPPLY 
    ? hre.ethers.parseUnits(process.env.WRAPPED_USDC_INITIAL_SUPPLY, 6)
    : 0n;

  console.log("   Initial Supply:", hre.ethers.formatUnits(initialSupply, 6), "USDC.k");

  const WrappedUSDC = await hre.ethers.getContractFactory("WrappedUSDC");
  const wrappedUsdc = await WrappedUSDC.deploy(initialSupply);
  await wrappedUsdc.waitForDeployment();
  const wrappedUsdcAddress = await wrappedUsdc.getAddress();

  // Verify name and symbol
  const name = await wrappedUsdc.name();
  const symbol = await wrappedUsdc.symbol();
  console.log("   ✅ Deployed:", wrappedUsdcAddress);
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);

  if (name !== "USDC Krump" || symbol !== "USDC.k") {
    console.error("   ⚠️  Warning: Name/Symbol mismatch! Expected 'USDC Krump' / 'USDC.k'");
  }

  const wrappedUsdcDeployment = {
    chain: network.name,
    chainId: Number(network.chainId),
    wrappedUSDC: wrappedUsdcAddress,
    name: name,
    symbol: symbol,
    initialSupply: initialSupply.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const wrappedUsdcFilename = `deployments/wrapped-usdc-${network.name}-latest.json`;
  fs.writeFileSync(wrappedUsdcFilename, JSON.stringify(wrappedUsdcDeployment, null, 2));
  console.log("   Saved:", wrappedUsdcFilename);
  console.log("");

  // Step 2: Deploy new OAppProxyOFT
  console.log("📦 Step 2: Deploying new OAppProxyOFT (wrapping new WrappedUSDC)...");
  
  const endpointAddress = process.env.STORY_AENEID_ENDPOINT || "0xdB09C62692B837C6bd8E53dF33957E5f018A68B4";
  const delegate = process.env.DELEGATE_ADDRESS || deployer.address;
  
  console.log("   Wrapped USDC:", wrappedUsdcAddress);
  console.log("   Endpoint:", endpointAddress);
  console.log("   Delegate:", delegate);

  const OAppProxyOFT = await hre.ethers.getContractFactory("OAppProxyOFT");
  const proxyOft = await OAppProxyOFT.deploy(wrappedUsdcAddress, endpointAddress, delegate);
  await proxyOft.waitForDeployment();
  const proxyOftAddress = await proxyOft.getAddress();

  console.log("   ✅ Deployed:", proxyOftAddress);

  const proxyOftDeployment = {
    chain: network.name,
    chainId: Number(network.chainId),
    oappProxyOft: proxyOftAddress,
    wrappedToken: wrappedUsdcAddress,
    endpoint: endpointAddress,
    delegate: delegate,
    deployedAt: new Date().toISOString(),
  };

  const proxyOftFilename = `deployments/oapp-proxy-oft-${network.name}-latest.json`;
  fs.writeFileSync(proxyOftFilename, JSON.stringify(proxyOftDeployment, null, 2));
  console.log("   Saved:", proxyOftFilename);
  console.log("");

  // Step 3: Load Base Sepolia deployment
  console.log("📦 Step 3: Loading Base Sepolia OAppProxyOFT deployment...");
  let baseDeployment;
  try {
    baseDeployment = JSON.parse(
      fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
    );
    console.log("   ✅ Found Base Sepolia OAppProxyOFT:", baseDeployment.oappProxyOft);
  } catch (error) {
    console.error("   ❌ Error: Could not load Base Sepolia deployment");
    console.error("   Make sure Base Sepolia OAppProxyOFT is deployed first");
    console.log("");
    console.log("📝 Next steps:");
    console.log("   1. Deploy OAppProxyOFT on Base Sepolia (if not already done)");
    console.log("   2. Run link:proxy-oft script to connect peers");
    console.log("   3. Update frontend config with new addresses");
    process.exit(1);
  }
  console.log("");

  // Step 4: Set peers
  console.log("📦 Step 4: Setting peers...");
  const BASE_SEPOLIA_EID = 40245;
  const STORY_AENEID_EID = 1315;

  const basePeer = hre.ethers.zeroPadValue(baseDeployment.oappProxyOft, 32);
  const storyPeer = hre.ethers.zeroPadValue(proxyOftAddress, 32);

  console.log("   Setting peer on Story Aeneid (pointing to Base Sepolia)...");
  const storyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftAddress);
  const tx1 = await storyOft.setPeer(BASE_SEPOLIA_EID, basePeer);
  console.log("   Transaction:", tx1.hash);
  await tx1.wait();
  console.log("   ✅ Story Aeneid peer set");

  console.log("");
  console.log("   ⚠️  IMPORTANT: You must also set the peer on Base Sepolia!");
  console.log("   Run on Base Sepolia:");
  console.log(`   npm run link:proxy-oft -- --network baseSepolia`);
  console.log("");

  // Summary
  console.log("✅ Redeployment Complete!");
  console.log("=========================\n");
  console.log("New Contracts:");
  console.log("  WrappedUSDC (USDC Krump):", wrappedUsdcAddress);
  console.log("  OAppProxyOFT (Story Aeneid):", proxyOftAddress);
  console.log("");
  console.log("📝 Next Steps:");
  console.log("  1. Set peer on Base Sepolia:");
  console.log("     npm run link:proxy-oft -- --network baseSepolia");
  console.log("");
  console.log("  2. Update frontend config.ts:");
  console.log(`     wrappedUsdc: '${wrappedUsdcAddress}'`);
  console.log(`     oappProxyOft: '${proxyOftAddress}'`);
  console.log("");
  console.log("  3. Verify contracts on block explorer:");
  console.log("     npm run verify:wrapped-usdc-story -- --network storyAeneid");
  console.log("     npm run verify:proxy-oft-story -- --network storyAeneid");
  console.log("");
  console.log("  4. (Optional) Authorize OAppProxyOFT as minter:");
  console.log(`     wrappedUSDC.setMinter('${proxyOftAddress}', true)`);
  console.log("");
  console.log("Credits: StreetKode Fam Initiative (Asura, Hectik, Kronos, Jo)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
