/**
 * Test sending USDCKrumpOFT via LayerZero from Base Sepolia to Story Aeneid.
 * This will trigger PacketSent event that the executor worker should pick up.
 * 
 * Usage:
 *   npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🧪 Testing USDCKrumpOFT LayerZero send (Base → Story)");
  console.log("   Sender:", signer.address);
  console.log("   OFT:", baseOft.address);

  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const balance = await oft.balanceOf(signer.address);
  
  if (balance === 0n) {
    console.log("\n⚠️  No USDC.k balance. Mint some first:");
    console.log("   npx hardhat run scripts/mint-test-tokens.js --network baseSepolia");
    process.exit(1);
  }

  const amount = hre.ethers.parseUnits("0.1", 6);
  if (amount > balance) {
    console.log("\n❌ Insufficient balance");
    process.exit(1);
  }

  // Story Aeneid EID = 1315, recipient = user's address on Story Aeneid (bytes32)
  const recipient = signer.address; // Send to self for testing
  const recipientBytes32 = hre.ethers.zeroPadValue(recipient, 32);

  console.log("\n📤 Sending", hre.ethers.formatUnits(amount, 6), "USDC.k to Story Aeneid...");
  console.log("   Recipient:", recipient);

  // Get quote first
  const sendParam = {
    dstEid: 1315,
    to: recipientBytes32,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee), "LZ");

    const fee = {
      nativeFee,
      lzTokenFee,
    };

    const tx = await oft.send(sendParam, fee, signer.address, { value: nativeFee });
    const receipt = await tx.wait();
    
    console.log("\n✅ Send transaction:", tx.hash);
    console.log("   Block:", receipt.blockNumber);
    console.log("   The LayerZero executor worker should pick this up and execute on Story Aeneid.");
    console.log("   Check Story Aeneid balance after execution completes (~1-2 min).");
  } catch (e) {
    console.error("❌ Send failed:", e.message);
    if (e.data) console.error("   Error data:", e.data);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
