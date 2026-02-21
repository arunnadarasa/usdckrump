/**
 * Test quote after waiting for state to update
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🧪 Testing Quote After State Update");
  console.log("=".repeat(60));
  
  // Wait a bit for state to sync
  console.log("Waiting 5 seconds for state to sync...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check send library again
  console.log("\nChecking send library...");
  const [lib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  const defaultLib = await endpoint.defaultSendLibrary(1315);
  
  console.log("getSendLibrary():", lib);
  console.log("isDefaultSendLibrary():", isDefault);
  console.log("defaultSendLibrary():", defaultLib);
  
  // Try quoteSend
  console.log("\nTesting quoteSend...");
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
    console.log("✅ quoteSend successful!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
    
    // If quote works, try send
    console.log("\nTesting send...");
    const fee = {
      nativeFee,
      lzTokenFee
    };
    
    const tx = await oft.send(sendParam, fee, signer.address, { value: nativeFee });
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Send successful!");
    console.log("   Block:", receipt.blockNumber);
    console.log("\n🎉 LayerZero V2 test successful!");
    console.log("   The executor worker should pick this up and execute on Story Aeneid.");
    
  } catch (e) {
    console.log("❌ Failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      console.log("   Selector:", e.data.slice(0, 10));
      
      // Check if it's LZ_DefaultSendLibUnavailable
      if (e.data.slice(0, 10).toLowerCase() === "0x6592671c") {
        console.log("\n💡 Error: LZ_DefaultSendLibUnavailable");
        console.log("   This means getSendLibrary is returning 0");
        console.log("   Even though defaultSendLibrary(1315) is set correctly");
        console.log("   This might be a view function issue or storage read problem");
      }
    }
  }
}

main().catch(console.error);
