/**
 * Check if delegate mechanism affects getSendLibrary resolution
 * The OFT might be calling quote() through a delegate
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);

  console.log("🔍 Checking delegate mechanism\n");

  // Check if OFT has a delegate set
  const delegate = await endpoint.delegates(baseOft.address);
  console.log("1. OFT delegate:", delegate);
  console.log("   Is zero:", delegate === "0x0000000000000000000000000000000000000000");

  // Check getSendLibrary for OFT
  const lib1 = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("\n2. getSendLibrary(OFT, 1315):", lib1);

  // Check getSendLibrary for delegate (if set)
  if (delegate !== "0x0000000000000000000000000000000000000000") {
    const lib2 = await endpoint.getSendLibrary(delegate, 1315);
    console.log("   getSendLibrary(delegate, 1315):", lib2);
  }

  // Check who the OFT's owner/delegate is
  const oftDelegate = await oft.delegate();
  console.log("\n3. OFT's delegate (from OFT contract):", oftDelegate);

  // When OFT calls endpoint.quote(), who is msg.sender?
  // It should be the OFT contract itself
  // But maybe the library resolution uses delegate?

  // Let's check if there's a pattern where quote() resolves sender differently
  console.log("\n4. Testing quote() with different sender addresses:");

  const recipient = hre.ethers.zeroPadValue("0x35df28Db852f528282Dd26AAa0C3968aac1d3a25", 32);
  const messagingParams = {
    dstEid: 1315,
    receiver: recipient,
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  // Test with OFT address as sender
  console.log("\n   Testing with OFT address as sender:");
  try {
    const fee1 = await endpoint.quote(messagingParams, baseOft.address);
    console.log("   ✅ Success!");
  } catch (e) {
    console.log("   ❌ Failed:", e.message);
    if (e.data) {
      const errorSig = e.data.slice(0, 10);
      if (errorSig === "0x6592671c") {
        console.log("   LZ_DefaultSendLibUnavailable()");
      }
    }
  }

  // Test with delegate as sender (if delegate exists)
  if (delegate !== "0x0000000000000000000000000000000000000000") {
    console.log("\n   Testing with delegate address as sender:");
    try {
      const fee2 = await endpoint.quote(messagingParams, delegate);
      console.log("   ✅ Success!");
    } catch (e) {
      console.log("   ❌ Failed:", e.message);
    }
  }

  // Check if there's a pattern in how quote() resolves the sender
  // Maybe it uses delegates mapping?
  console.log("\n5. Checking if quote() uses delegates for sender resolution:");
  console.log("   This would explain why getSendLibrary(OFT) works but quote(OFT) fails");

  console.log("\n✅ Analysis complete");
}

main().catch(console.error);
