/**
 * Test EndpointV2.quote() manually with MessagingParams
 * to see if we can reproduce the LZ_DefaultSendLibUnavailable error
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🧪 Testing EndpointV2.quote() manually\n");

  // First verify getSendLibrary works
  const lib = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("1. getSendLibrary():", lib);
  console.log("   Expected:", ownEndpoint.sendUln302);
  console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());

  // Try to build MessagingParams similar to what OFT would build
  // OFT's quoteSend() likely calls endpoint.quote() with:
  // - _sender = address(this) (the OFT contract)
  // - _params.dstEid = sendParam.dstEid
  // - _params.receiver = sendParam.to (bytes32)
  // - _params.message = encoded OFT message
  // - _params.options = sendParam.extraOptions
  // - _params.payInLzToken = false

  const recipient = signer.address;
  const recipientBytes32 = hre.ethers.zeroPadValue(recipient, 32);
  const amount = hre.ethers.parseUnits("0.1", 6);

  // Build a simple message (OFT would encode amountLD, minAmountLD, etc.)
  // For testing, let's try with minimal message
  const message = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint64", "uint256", "uint256"],
    [0n, amount, amount] // nonce, amountLD, minAmountLD (simplified)
  );

  const messagingParams = {
    dstEid: 1315,
    receiver: recipientBytes32,
    message: message,
    options: "0x",
    payInLzToken: false
  };

  console.log("\n2. Testing endpoint.quote() with manual params:");
  console.log("   _sender:", baseOft.address);
  console.log("   dstEid:", messagingParams.dstEid);
  console.log("   receiver:", messagingParams.receiver);

  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ Success!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee));
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee));
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
      if (errorSig === "0x6592671c") {
        console.log("   This is LZ_DefaultSendLibUnavailable()");
        console.log("   This confirms the issue is in endpoint.quote()");
      }
    }
  }

  // Also test with OFT's quoteSend for comparison
  console.log("\n3. Testing OFT.quoteSend() for comparison:");
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
    console.log("   ✅ Success!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee));
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      console.log("   Error signature:", errorSig);
    }
  }

  console.log("\n✅ Test complete");
}

main().catch(console.error);
