/**
 * Diagnose LayerZero send issues
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  const [signer] = await hre.ethers.getSigners();
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Diagnosing LayerZero V2 Configuration\n");
  console.log("Base OFT:", baseOft.address);
  console.log("Story OFT:", storyOft.address);
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("Sender:", signer.address, "\n");

  // Check balance
  const balance = await oft.balanceOf(signer.address);
  console.log("1. Balance:", hre.ethers.formatUnits(balance, 6), "USDC.k\n");

  // Check peers using OFT's peer function
  console.log("2. Checking peers...");
  try {
    const peer = await oft.peers(1315);
    console.log("   Base → Story peer:", peer);
    const expectedPeer = hre.ethers.zeroPadValue(storyOft.address, 32);
    console.log("   Expected:", expectedPeer);
    console.log("   Match:", peer.toLowerCase() === expectedPeer.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   ❌ Error checking peers:", e.message);
  }

  // Check send library
  console.log("\n3. Checking send library...");
  try {
    const [sendLib, isDefault] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Send library:", sendLib);
    console.log("   Is default:", isDefault);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", sendLib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Check receive library
  console.log("\n4. Checking receive library...");
  try {
    const [receiveLib, isDefault] = await endpoint.getReceiveLibrary(baseOft.address, 1315);
    console.log("   Receive library:", receiveLib);
    console.log("   Is default:", isDefault);
  } catch (e) {
    console.log("   ❌ Error:", e.message);
  }

  // Try quote
  console.log("\n5. Testing quote...");
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
    console.log("   ✅ Quote successful!");
    console.log("   Native fee:", hre.ethers.formatEther(nativeFee), "ETH");
    console.log("   LZ token fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
  } catch (e) {
    console.log("   ❌ Quote failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      // Try to decode common errors
      const errorInterface = new hre.ethers.Interface([
        "error NoPeer(uint32 eid)",
        "error LZ_UnsupportedEid()",
        "error LZ_DefaultSendLibUnavailable()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded error:", decoded.name, decoded.args);
      } catch {}
    }
  }
}

main().catch(console.error);
