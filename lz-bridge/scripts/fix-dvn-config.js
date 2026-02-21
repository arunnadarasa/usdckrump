/**
 * Fix DVN config by deploying SimpleDVN and updating ULN config
 * Root cause: ReceiveUln302 doesn't implement ILayerZeroDVN.getFee()
 */
const hre = require("hardhat");
const fs = require("fs");

const logPath = '/Users/openclaw/Documents/USDC Krump/.cursor/debug.log';

async function logDebug(runId, hypothesisId, location, message, data) {
  const logEntry = {
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now()
  };
  
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    // Ignore file errors
  }
  
  try {
    if (typeof fetch !== 'undefined') {
      await fetch('http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore logging errors
  }
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const runId = `fix_dvn_${Date.now()}`;
  
  console.log("🔧 Fixing DVN Config");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address, "\n");

  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const dstEid = 1315;

  // Verify endpoint owner
  const endpointOwner = await endpoint.owner();
  if (endpointOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not endpoint owner!");
    process.exit(1);
  }

  console.log("📋 Current Configuration:");
  console.log("   EndpointV2:", ownEndpoint.endpointV2);
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Destination EID:", dstEid, "\n");

  // Step 1: Deploy SimpleDVN
  console.log("1. Deploying SimpleDVN...");
  await logDebug(runId, "H1", "fix-dvn-config.js:60", "Deploying SimpleDVN", {});
  let simpleDVNAddress;
  try {
    const SimpleDVN = await hre.ethers.getContractFactory("SimpleDVN");
    const simpleDVN = await SimpleDVN.deploy();
    await simpleDVN.waitForDeployment();
    simpleDVNAddress = await simpleDVN.getAddress();
    console.log("   ✅ SimpleDVN deployed:", simpleDVNAddress);
    await logDebug(runId, "H1", "fix-dvn-config.js:67", "SimpleDVN deployed", { address: simpleDVNAddress });
  } catch (e) {
    console.log("   ❌ Failed to deploy SimpleDVN:", e.message);
    await logDebug(runId, "H1", "fix-dvn-config.js:70", "Deploy failed", { error: e.message });
    process.exit(1);
  }

  // Step 2: Update ULN config to use SimpleDVN
  console.log("\n2. Updating ULN config to use SimpleDVN...");
  await logDebug(runId, "H1", "fix-dvn-config.js:76", "Updating ULN config", { simpleDVN: simpleDVNAddress });
  
  const ulnConfig = {
    confirmations: 1,
    requiredDVNCount: 0,
    optionalDVNCount: 1,
    optionalDVNThreshold: 1,
    requiredDVNs: [],
    optionalDVNs: [simpleDVNAddress] // Use SimpleDVN instead of ReceiveUln302
  };

  const configParam = {
    eid: dstEid,
    configType: 2, // CONFIG_TYPE_ULN
    config: hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(uint64,uint16,uint16,uint16,address[],address[])"],
      [[
        ulnConfig.confirmations,
        ulnConfig.requiredDVNCount,
        ulnConfig.optionalDVNCount,
        ulnConfig.optionalDVNThreshold,
        ulnConfig.requiredDVNs,
        ulnConfig.optionalDVNs
      ]]
    )
  };

  try {
    const tx = await endpoint.setConfig(proxyOftDeployment.oappProxyOft, ownEndpoint.sendUln302, [configParam]);
    const receipt = await tx.wait();
    console.log("   ✅ ULN config updated");
    console.log("   Transaction:", receipt.hash);
    await logDebug(runId, "H1", "fix-dvn-config.js:100", "ULN config updated", { txHash: receipt.hash });
  } catch (e) {
    const errorSig = e.data ? e.data.slice(0, 10) : "unknown";
    console.log("   ❌ Failed to update ULN config:", e.message);
    console.log("   Error signature:", errorSig);
    await logDebug(runId, "H1", "fix-dvn-config.js:106", "Update failed", {
      error: e.message,
      errorSig,
      errorData: e.data
    });
    process.exit(1);
  }

  // Step 3: Test DVN.getFee()
  console.log("\n3. Testing SimpleDVN.getFee()...");
  await logDebug(runId, "H1", "fix-dvn-config.js:114", "Testing SimpleDVN.getFee", {});
  try {
    const ILayerZeroDVN = new hre.ethers.Interface([
      "function getFee(uint32 dstEid, uint64 confirmations, address sender, bytes calldata options) external view returns (uint256)"
    ]);
    const dvnContract = new hre.ethers.Contract(simpleDVNAddress, ILayerZeroDVN, hre.ethers.provider);
    const dvnFee = await dvnContract.getFee.staticCall(dstEid, 1n, proxyOftDeployment.oappProxyOft, "0x");
    console.log("   ✅ SimpleDVN.getFee works!");
    console.log("   Fee:", hre.ethers.formatEther(dvnFee), "ETH");
    await logDebug(runId, "H1", "fix-dvn-config.js:123", "SimpleDVN.getFee success", { fee: dvnFee.toString() });
  } catch (e) {
    console.log("   ❌ SimpleDVN.getFee failed:", e.message);
    await logDebug(runId, "H1", "fix-dvn-config.js:126", "SimpleDVN.getFee failed", { error: e.message });
  }

  // Step 4: Test quoteSend
  console.log("\n4. Testing quoteSend...");
  await logDebug(runId, "ALL", "fix-dvn-config.js:131", "Testing quoteSend", {});
  
  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(deployer.address, 32);

  // Create minimal Type 3 options
  function createMinimalType3Options() {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17;
    const GAS = 0n;
    
    return hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );
  }

  const SEND = 1;
  let extraOptions = createMinimalType3Options();
  try {
    const combined = await proxyOft.combineOptions(dstEid, SEND, "0x");
    if (combined !== "0x" && combined.length >= 2) {
      extraOptions = combined;
    }
  } catch (e) {
    // Use Type 3 options
  }

  const sendParam = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: extraOptions,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    await logDebug(runId, "ALL", "fix-dvn-config.js:170", "quoteSend success", {
      nativeFee: nativeFee.toString()
    });
    console.log("\n   🎉 DVN config fixed and quoteSend works!");
  } catch (error) {
    const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
    console.log("   ❌ quoteSend still failed:", error.message);
    console.log("   Error signature:", errorSig);
    await logDebug(runId, "ALL", "fix-dvn-config.js:178", "quoteSend still failed", {
      error: error.message,
      errorSig,
      errorData: error.data
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Fix complete!");
  console.log("=".repeat(60));
}

main().catch(async (e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
