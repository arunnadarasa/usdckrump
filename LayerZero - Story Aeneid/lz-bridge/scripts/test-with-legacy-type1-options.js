/**
 * Test quoteSend with properly encoded legacy type 1 options
 * LayerZero V2 requires at least 2 bytes for options (the option type)
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
  console.log("🧪 Testing with Legacy Type 1 Options");
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

  // Legacy Type 1 options format: [type (2 bytes)][extraGas (32 bytes)]
  // Type 1 = 0x0001, extraGas = 0 (minimal)
  const legacyType1Options = hre.ethers.solidityPacked(
    ["uint16", "uint256"],
    [1, 0] // Type 1, extraGas = 0
  );

  console.log("📝 Options encoding:");
  console.log("   Type: Legacy Type 1");
  console.log("   Extra Gas: 0");
  console.log("   Encoded:", legacyType1Options);
  console.log("   Length:", legacyType1Options.length, "bytes\n");

  const sendParam = {
    dstEid: 1315,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: legacyType1Options,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  console.log("📤 Testing quoteSend...");
  try {
    const [nativeFee] = await proxyOft.quoteSend(sendParam, false);
    console.log("   ✅ quoteSend SUCCESS!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("\n   🎉 Legacy Type 1 options work!");
    console.log("\n   💡 Solution: Use legacy type 1 options instead of empty options");
    console.log("      Format: [type: uint16][extraGas: uint256]");
    console.log("      Example: 0x000100000000000000000000000000000000000000000000000000000000000000000000");
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
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
