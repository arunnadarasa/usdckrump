/**
 * Check decimals and sharedDecimals configuration
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));

  const oftBase = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const oftStory = await hre.ethers.getContractAt("USDCKrumpOFT", storyOft.address);

  console.log("🔍 Checking Decimals Configuration");
  console.log("=".repeat(60));
  
  // Check decimals
  const decimalsBase = await oftBase.decimals();
  const decimalsStory = await oftStory.decimals();
  
  console.log("Base Sepolia OFT:");
  console.log("   Decimals:", decimalsBase.toString());
  console.log("   Expected: 6");
  console.log("   Match:", decimalsBase === 6n ? "✅" : "❌");
  
  console.log("\nStory Aeneid OFT:");
  console.log("   Decimals:", decimalsStory.toString());
  console.log("   Expected: 6");
  console.log("   Match:", decimalsStory === 6n ? "✅" : "❌");
  
  // Check sharedDecimals
  try {
    const sharedDecimalsBase = await oftBase.sharedDecimals();
    const sharedDecimalsStory = await oftStory.sharedDecimals();
    
    console.log("\nShared Decimals:");
    console.log("   Base:", sharedDecimalsBase.toString());
    console.log("   Story:", sharedDecimalsStory.toString());
    console.log("   Match:", sharedDecimalsBase === sharedDecimalsStory ? "✅" : "❌");
    
    // Calculate decimalConversionRate
    // decimalConversionRate = 10^(sharedDecimals - decimals)
    const conversionRateBase = 10n ** (sharedDecimalsBase - decimalsBase);
    const conversionRateStory = 10n ** (sharedDecimalsStory - decimalsStory);
    
    console.log("\nDecimal Conversion Rate:");
    console.log("   Base:", conversionRateBase.toString());
    console.log("   Story:", conversionRateStory.toString());
    
    // Test _removeDust logic
    const testAmount = hre.ethers.parseUnits("0.1", 6); // 100000
    const removedDustBase = (testAmount / conversionRateBase) * conversionRateBase;
    const removedDustStory = (testAmount / conversionRateStory) * conversionRateStory;
    
    console.log("\n_removeDust Test (0.1 USDC.k = 100000):");
    console.log("   Base result:", removedDustBase.toString());
    console.log("   Story result:", removedDustStory.toString());
    console.log("   Expected: 100000");
    console.log("   Base match:", removedDustBase === testAmount ? "✅" : "❌");
    console.log("   Story match:", removedDustStory === testAmount ? "✅" : "❌");
    
    if (removedDustBase === 0n || removedDustStory === 0n) {
      console.log("\n❌ _removeDust is removing the entire amount!");
      console.log("   This causes SlippageExceeded error");
      console.log("   Issue: decimalConversionRate is too large");
    }
  } catch (e) {
    console.log("\n⚠️  Could not check sharedDecimals:", e.message);
  }
}

main().catch(console.error);
