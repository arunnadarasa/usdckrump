/**
 * Decode the LayerZero error
 */
const hre = require("hardhat");

async function main() {
  const errorData = "0x71c4efed000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000186a0";
  
  console.log("🔍 Decoding Error");
  console.log("=".repeat(60));
  console.log("Error data:", errorData);
  console.log("Selector:", errorData.slice(0, 10));
  console.log("Params:", errorData.slice(10));
  
  // Calculate error selectors
  const errorInterface = new hre.ethers.Interface([
    "error NoPeer(uint32 eid)",
    "error OnlyPeer(uint32 eid, bytes32 sender)",
    "error LZ_UnsupportedEid()",
    "error LZ_DefaultSendLibUnavailable()",
    "error InvalidEndpointCall()",
    "error InvalidDelegate()"
  ]);
  
  // Try to decode
  try {
    const decoded = errorInterface.parseError(errorData);
    console.log("\n✅ Decoded Error:");
    console.log("   Name:", decoded.name);
    console.log("   Args:", decoded.args);
    
    if (decoded.name === "NoPeer") {
      const eid = decoded.args[0];
      console.log("\n   EID:", eid.toString());
      console.log("   Expected EID: 1315");
      console.log("   Match:", eid === 1315n ? "✅" : "❌");
    }
  } catch (e) {
    console.log("\n❌ Could not decode with standard errors");
    console.log("   Error:", e.message);
    
    // Try manual decoding
    const selector = errorData.slice(0, 10);
    const params = errorData.slice(10);
    
    console.log("\n📋 Manual Analysis:");
    console.log("   Selector:", selector);
    
    // Check if it's NoPeer - selector would be keccak256("NoPeer(uint32)")[:4]
    const noPeerSig = hre.ethers.id("NoPeer(uint32)").slice(0, 10);
    console.log("   NoPeer(uint32) selector:", noPeerSig);
    console.log("   Match:", selector.toLowerCase() === noPeerSig.toLowerCase() ? "✅" : "❌");
    
    if (params.length > 0) {
      // Try to decode as uint32
      try {
        const eid = BigInt(params);
        console.log("   Decoded EID (as uint256):", eid.toString());
        console.log("   Expected: 1315");
      } catch {}
    }
  }
}

main().catch(console.error);
