/**
 * Test _debitView logic to understand SlippageExceeded error
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🔍 Testing _debitView Logic");
  console.log("=".repeat(60));
  
  const amountLD = hre.ethers.parseUnits("0.1", 6); // 100000
  const minAmountLD = hre.ethers.parseUnits("0.1", 6); // 100000
  const dstEid = 1315;
  
  console.log("Amount LD:", amountLD.toString());
  console.log("Min Amount LD:", minAmountLD.toString());
  console.log("Dst EID:", dstEid, "\n");
  
  // The error is SlippageExceeded(0, 100000)
  // This means amountReceivedLD = 0, minAmountLD = 100000
  // So _debitView is returning 0 for amountReceivedLD
  
  // In OFTCore._debitView:
  // amountSentLD = _removeDust(_amountLD)
  // amountReceivedLD = amountSentLD
  // if (amountReceivedLD < _minAmountLD) revert SlippageExceeded(amountReceivedLD, _minAmountLD)
  
  // So _removeDust must be returning 0!
  
  // Let's check what _removeDust does
  // It's in OFTAdapter or OFT
  console.log("📋 Checking decimal conversion...");
  
  // OFT uses _toSD and _toLD for decimal conversion
  // _removeDust removes dust based on shared decimals
  
  // Let's check the decimals
  const decimals = await oft.decimals();
  console.log("OFT decimals:", decimals.toString());
  
  // Check if there's a sharedDecimals issue
  // OFT might have sharedDecimals that's different from local decimals
  // If sharedDecimals > localDecimals, _removeDust might remove everything
  
  // Actually, let me check the OFT implementation
  // USDCKrumpOFT extends OFT, which should handle decimals correctly
  
  // The issue might be that when converting to shared decimals and back,
  // the amount becomes 0 due to rounding
  
  console.log("\n💡 Hypothesis: Decimal conversion issue");
  console.log("   _removeDust might be removing the entire amount");
  console.log("   This could happen if sharedDecimals > localDecimals");
  console.log("   and the conversion results in 0");
  
  // Let's try with a larger amount to see if it works
  console.log("\n🧪 Testing with larger amount...");
  const largerAmount = hre.ethers.parseUnits("1", 6); // 1 USDC.k
  const sendParam = {
    dstEid: 1315,
    to: hre.ethers.zeroPadValue(signer.address, 32),
    amountLD: largerAmount,
    minAmountLD: largerAmount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };
  
  try {
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   ✅ Quote successful with larger amount!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("\n   💡 The issue is with small amounts - dust removal!");
  } catch (e) {
    console.log("   ❌ Still fails:", e.message);
    if (e.data) {
      const selector = e.data.slice(0, 10);
      console.log("   Error selector:", selector);
      if (selector.toLowerCase() === "0x71c4efed") {
        console.log("   ✅ Confirmed: SlippageExceeded error");
        console.log("   This confirms the issue is with _removeDust removing the amount");
      }
    }
  }
}

main().catch(console.error);
