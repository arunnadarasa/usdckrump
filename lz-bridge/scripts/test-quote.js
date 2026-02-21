const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  const sendParam = {
    dstEid: 1315,
    to: hre.ethers.zeroPadValue(signer.address, 32),
    amountLD: hre.ethers.parseUnits("0.1", 6),
    minAmountLD: hre.ethers.parseUnits("0.1", 6),
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("✅ Quote successful!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee));
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee));
  } catch (e) {
    console.error("❌ Quote failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    if (e.reason) console.error("   Reason:", e.reason);
  }
}

main().catch(console.error);
