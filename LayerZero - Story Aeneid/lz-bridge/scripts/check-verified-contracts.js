const hre = require("hardhat");
const fs = require("fs");

/**
 * Check all key view functions on verified contracts:
 * - Base Sepolia USDCDanceOFT
 * - Story Aeneid USDCDanceOFT
 * - Story Aeneid EVVMPaymentAdapter
 */

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const STORY_AENEID_RPC = process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io";
const DEPLOYER = "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25";

async function checkOFT(provider, name, address) {
  const oft = await hre.ethers.getContractAt("USDCDanceOFT", address, provider);
  const out = {};
  try {
    out.name = await oft.name();
    out.symbol = await oft.symbol();
    out.decimals = await oft.decimals();
    out.totalSupply = await oft.totalSupply();
    out.balanceOfDeployer = await oft.balanceOf(DEPLOYER);
    out.owner = await oft.owner();
    out.danceVerifyBackend = await oft.danceVerifyBackend();
    out.DEPLOYMENT_VERSION = await oft.DEPLOYMENT_VERSION();
    out.domainSeparator = await oft.getDomainSeparator();
  } catch (e) {
    out.error = e.message;
  }
  // Peers: Base <-> Story
  try {
    out.peerStoryAeneid = await oft.peers(1315);
    out.peerBaseSepolia = await oft.peers(84532);
  } catch (e) {
    out.peersError = e.message;
  }
  return out;
}

async function checkAdapter(provider, address) {
  const adapter = await hre.ethers.getContractAt("EVVMPaymentAdapter", address, provider);
  const out = {};
  try {
    out.usdcDance = await adapter.usdcDance();
    out.evvmCore = await adapter.evvmCore();
    out.evvmId = await adapter.evvmId();
    out.owner = await adapter.owner();
    const info = await adapter.getEVVMPaymentInfo("test-receipt");
    out.getEVVMPaymentInfo = { from: info[0], to: info[1], amount: info[2].toString(), timestamp: info[3].toString(), exists: info[4] };
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

function formatUnits(value, decimals = 6) {
  return hre.ethers.formatUnits(value, decimals);
}

async function main() {
  console.log("🔍 Checking verified contracts (view functions)\n");
  console.log("=".repeat(60));

  const baseDeploy = JSON.parse(fs.readFileSync("deployments/usdc-base-sepolia-latest.json", "utf8"));
  const storyDeploy = JSON.parse(fs.readFileSync("deployments/usdc-story-aeneid-latest.json", "utf8"));
  const adapterDeploy = JSON.parse(fs.readFileSync("deployments/storyAeneid-evvm-adapter-latest.json", "utf8"));

  const baseProvider = new hre.ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const storyProvider = new hre.ethers.JsonRpcProvider(STORY_AENEID_RPC);

  // 1. Base Sepolia OFT
  console.log("\n📋 1. Base Sepolia USDCDanceOFT");
  console.log("   Address:", baseDeploy.address);
  const baseOft = await checkOFT(baseProvider, "Base Sepolia", baseDeploy.address);
  if (baseOft.error) {
    console.log("   ❌ Error:", baseOft.error);
  } else {
    console.log("   name:", baseOft.name);
    console.log("   symbol:", baseOft.symbol);
    console.log("   decimals:", baseOft.decimals);
    console.log("   totalSupply:", formatUnits(baseOft.totalSupply), "USDC.d");
    console.log("   balanceOf(deployer):", formatUnits(baseOft.balanceOfDeployer), "USDC.d");
    console.log("   owner:", baseOft.owner);
    console.log("   danceVerifyBackend:", baseOft.danceVerifyBackend);
    console.log("   DEPLOYMENT_VERSION:", baseOft.DEPLOYMENT_VERSION?.toString());
    console.log("   peer(1315) Story Aeneid:", baseOft.peerStoryAeneid || baseOft.peersError);
    console.log("   getDomainSeparator:", baseOft.domainSeparator ? baseOft.domainSeparator.slice(0, 18) + "..." : "—");
  }

  // 2. Story Aeneid OFT
  console.log("\n📋 2. Story Aeneid USDCDanceOFT");
  console.log("   Address:", storyDeploy.address);
  const storyOft = await checkOFT(storyProvider, "Story Aeneid", storyDeploy.address);
  if (storyOft.error) {
    console.log("   ❌ Error:", storyOft.error);
  } else {
    console.log("   name:", storyOft.name);
    console.log("   symbol:", storyOft.symbol);
    console.log("   decimals:", storyOft.decimals);
    console.log("   totalSupply:", formatUnits(storyOft.totalSupply), "USDC.d");
    console.log("   balanceOf(deployer):", formatUnits(storyOft.balanceOfDeployer), "USDC.d");
    console.log("   owner:", storyOft.owner);
    console.log("   danceVerifyBackend:", storyOft.danceVerifyBackend);
    console.log("   DEPLOYMENT_VERSION:", storyOft.DEPLOYMENT_VERSION?.toString());
    console.log("   peer(84532) Base Sepolia:", storyOft.peerBaseSepolia || storyOft.peersError);
    console.log("   getDomainSeparator:", storyOft.domainSeparator ? storyOft.domainSeparator.slice(0, 18) + "..." : "—");
  }

  // 3. EVVMPaymentAdapter
  console.log("\n📋 3. Story Aeneid EVVMPaymentAdapter");
  console.log("   Address:", adapterDeploy.address);
  const adapter = await checkAdapter(storyProvider, adapterDeploy.address);
  if (adapter.error) {
    console.log("   ❌ Error:", adapter.error);
  } else {
    console.log("   usdcDance:", adapter.usdcDance);
    console.log("   evvmCore:", adapter.evvmCore);
    console.log("   evvmId:", adapter.evvmId?.toString());
    console.log("   owner:", adapter.owner);
    console.log("   getEVVMPaymentInfo('test-receipt'):", adapter.getEVVMPaymentInfo?.exists ? "exists" : "no record");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Check complete. All view calls used verified contract ABIs.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
