/**
 * Force set send library directly to library address
 */
const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  console.log("⚙️  Force Setting Send Library");
  console.log("=".repeat(60));
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);
  
  // Verify SendUln302 supports EID 1315
  const supports = await sendUln.isSupportedEid(1315);
  console.log("SendUln302 supports EID 1315:", supports);
  if (!supports) {
    console.error("❌ SendUln302 doesn't support EID 1315!");
    process.exit(1);
  }

  // Verify SendUln302 is registered
  const registered = await endpoint.isRegisteredLibrary(ownEndpoint.sendUln302);
  console.log("SendUln302 registered:", registered);
  if (!registered) {
    console.error("❌ SendUln302 not registered!");
    process.exit(1);
  }

  console.log("\nSetting send library to:", ownEndpoint.sendUln302);

  try {
    const tx = await endpoint.setSendLibrary(baseOft.address, 1315, ownEndpoint.sendUln302);
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Success! Block:", receipt.blockNumber);
    
    // Verify immediately
    const [lib] = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   Verified library:", lib);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", lib.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      const errorInterface = new hre.ethers.Interface([
        "error LZ_UnsupportedEid()",
        "error LZ_Unauthorized()",
        "error LZ_OnlyRegisteredOrDefaultLib()",
        "error LZ_SameValue()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded:", decoded.name, decoded.args);
      } catch {}
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
