/**
 * Test quoteSend with Type 3 options containing minimal executor option
 * Type 3 format: [type: uint16][worker_id: uint8][option_size: uint16][option_type: uint8][option: bytes]
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("🧪 Testing with Type 3 Minimal Options");
  console.log("=".repeat(60));
  console.log("Deployer:", signer.address, "\n");

  // Load deployments
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const proxyOft = await hre.ethers.getContractAt("OAppProxyOFT", proxyOftDeployment.oappProxyOft);
  const token = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", proxyOftDeployment.wrappedToken);

  // Check balance
  const tokenBalance = await token.balanceOf(signer.address);
  console.log(`💰 Balance:`, hre.ethers.formatUnits(tokenBalance, 6), "USDC.k");
  if (tokenBalance === 0n) {
    console.log("⚠️  No balance. Please mint tokens first.");
    return;
  }

  const amount = hre.ethers.parseUnits("0.1", 6);
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Type 3 options with minimal executor option (LZReceive with 0 gas)
  // Format: [type: uint16=3][worker_id: uint8=1][option_size: uint16][option_type: uint8=1][gas: uint128=0]
  // Option size = 1 (option_type) + 16 (gas) = 17 bytes
  const TYPE_3 = 3;
  const WORKER_ID_EXECUTOR = 1;
  const OPTION_TYPE_LZRECEIVE = 1;
  const OPTION_SIZE = 17; // 1 byte (option_type) + 16 bytes (gas uint128)
  const GAS = 0n; // Minimal gas

  const type3Options = hre.ethers.solidityPacked(
    ["uint16", "uint8", "uint16", "uint8", "uint128"],
    [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
  );

  console.log("📝 Type 3 Options encoding:");
  console.log("   Type: 3");
  console.log("   Worker ID: 1 (Executor)");
  console.log("   Option Size: 17 bytes");
  console.log("   Option Type: 1 (LZReceive)");
  console.log("   Gas: 0");
  console.log("   Encoded:", type3Options);
  console.log("   Length:", type3Options.length, "bytes\n");

  const sendParam = {
    dstEid: 1315,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: type3Options,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  console.log("📤 Testing quoteSend...");
  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("\n   🎉 Type 3 minimal options work!");
    console.log("\n   💡 Solution: Use Type 3 options with minimal executor option");
    console.log("      Format: [type: 3][worker_id: 1][size: 17][option_type: 1][gas: 0]");
  } catch (error) {
    console.log("   ❌ quoteSend failed:", error.message);
    if (error.data) {
      const errorSig = error.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (error.data.length > 10) {
        const cursor = hre.ethers.dataSlice(error.data, 4);
        console.log("   Cursor:", cursor);
      }
    }
    
    // Try with combineOptions instead
    console.log("\n   🔄 Trying with combineOptions...");
    try {
      const SEND = 1;
      const combinedOptions = await proxyOft.combineOptions(1315, SEND, type3Options);
      console.log("   Combined options:", combinedOptions);
      
      const sendParam2 = {
        ...sendParam,
        extraOptions: combinedOptions,
      };
      
      const [nativeFee2] = await proxyOft.quoteSend(sendParam2, false);
      console.log("   ✅ quoteSend SUCCESS with combineOptions!");
      console.log("   Native Fee:", hre.ethers.formatEther(nativeFee2), "ETH");
      console.log("\n   🎉 combineOptions works!");
    } catch (e2) {
      console.log("   ❌ Still failed:", e2.message);
      if (e2.data) console.log("   Error data:", e2.data);
    }
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
