/**
 * Test quote directly on endpoint to see the actual error
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  const [signer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🧪 Testing Endpoint Quote Directly\n");
  console.log("OApp:", baseOft.address);
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("Sender:", signer.address, "\n");

  // Check send library resolution
  const [sendLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  console.log("Send library:", sendLib);
  console.log("Is default:", isDefault);
  
  const defaultSend = await endpoint.defaultSendLibrary(1315);
  console.log("Default send library:", defaultSend, "\n");

  // Try quote on endpoint
  const messagingParams = {
    dstEid: 1315,
    receiver: hre.ethers.zeroPadValue(signer.address, 32),
    message: "0x",
    options: "0x",
    payInLzToken: false
  };

  console.log("Calling endpoint.quote()...");
  try {
    const fee = await endpoint.quote(messagingParams, baseOft.address);
    console.log("✅ Quote successful!");
    console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee));
    console.log("   LZ token fee:", hre.ethers.formatEther(fee.lzTokenFee));
  } catch (e) {
    console.error("❌ Quote failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      // Try to decode common LayerZero errors
      const errorInterface = new hre.ethers.Interface([
        "error LZ_DefaultSendLibUnavailable()",
        "error LZ_UnsupportedEid()",
        "error NoPeer(uint32 eid)"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded error:", decoded.name, decoded.args);
      } catch {}
    }
  }
}

main().catch(console.error);
