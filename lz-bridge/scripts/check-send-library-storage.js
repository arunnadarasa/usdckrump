/**
 * Check send library storage directly
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Checking Send Library Storage");
  console.log("=".repeat(60));
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // Check storage slot directly
  // sendLibrary mapping is at slot determined by keccak256(abi.encode(key, slot))
  // The mapping is: mapping(address sender => mapping(uint32 dstEid => address lib)) sendLibrary
  
  // First, we need to find the storage slot for the mapping
  // For nested mappings: keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot)), key2))
  
  // The sendLibrary mapping slot - we need to find it in the contract
  // For now, let's use the public getter
  try {
    const [lib1] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("getSendLibrary() result:", lib1);
  } catch (e) {
    console.log("getSendLibrary() error:", e.message);
  }

  // Check if it's using default
  try {
    const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    console.log("isDefaultSendLibrary():", isDefault);
  } catch (e) {
    console.log("isDefaultSendLibrary() error:", e.message);
  }

  // Check default directly
  try {
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    console.log("defaultSendLibrary(1315):", defaultLib);
  } catch (e) {
    console.log("defaultSendLibrary() error:", e.message);
  }

  // Try calling quoteSend on OFT to see what error we get
  console.log("\n📤 Testing quoteSend on OFT...");
  const oft = await hre.ethers.getContractAt("USDCKrumpOFT", baseOft.address);
  const [signer] = await hre.ethers.getSigners();

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
  } catch (e) {
    console.log("❌ quoteSend failed:", e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
      // Try to find error selector
      const selector = e.data.slice(0, 10);
      console.log("   Error selector:", selector);
    }
  }
}

main().catch(console.error);
