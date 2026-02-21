/**
 * Test EndpointV2.quote() directly to see if it fails with LZ_DefaultSendLibUnavailable
 * This will help us understand if the issue is in quote() or in OFT's quoteSend()
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🧪 Testing EndpointV2.quote() directly\n");

  // First, check getSendLibrary
  console.log("1. Checking getSendLibrary():");
  const lib = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("   Library:", lib);
  console.log("   Is zero:", lib === "0x0000000000000000000000000000000000000000");
  console.log("   Expected:", ownEndpoint.sendUln302);

  // Now test quote directly
  console.log("\n2. Testing EndpointV2.quote():");

  // Build MessagingParams similar to what OFT would send
  const recipient = signer.address;
  const recipientBytes32 = hre.ethers.zeroPadValue(recipient, 32);
  const amount = hre.ethers.parseUnits("0.1", 6);

  // OFT's sendParam structure
  const sendParam = {
    dstEid: 1315,
    to: recipientBytes32,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  // Build the message that OFT would send
  // This is complex - let's try calling quoteSend on OFT but trace what happens
  console.log("\n3. Testing OFT.quoteSend() with detailed error:");
  try {
    const [nativeFee, lzTokenFee] = await oft.quoteSend(sendParam, false);
    console.log("   ✅ Success!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee));
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee));
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      
      // Try to decode error
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      
      if (errorSig === "0x6592671c") {
        console.log("   This is LZ_DefaultSendLibUnavailable()");
        console.log("   This means getSendLibrary() returned address(0) during execution");
      }
    }
    
    // Check if we can call getSendLibrary during the same block
    console.log("\n4. Checking getSendLibrary() again:");
    const lib2 = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Library:", lib2);
    console.log("   Still correct:", lib2.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
  }

  console.log("\n✅ Test complete");
}

main().catch(console.error);
