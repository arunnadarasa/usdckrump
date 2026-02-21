/**
 * Verify storage directly to understand the contradiction
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  console.log("🔍 Verifying Storage Directly");
  console.log("=".repeat(60));
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315\n");

  // Check 1: Verify addresses match exactly
  console.log("1. Verifying address consistency...");
  const oappAddress1 = baseOft.address.toLowerCase();
  const oappAddress2 = baseOft.address.toLowerCase();
  console.log("   OApp address (setSendLibrary):", oappAddress1);
  console.log("   OApp address (getSendLibrary):", oappAddress2);
  console.log("   Match:", oappAddress1 === oappAddress2 ? "✅" : "❌");
  
  const eid1 = 1315;
  const eid2 = 1315;
  console.log("   EID (setSendLibrary):", eid1);
  console.log("   EID (getSendLibrary):", eid2);
  console.log("   Match:", eid1 === eid2 ? "✅" : "❌");

  // Check 2: Read storage slot directly
  console.log("\n2. Reading storage slot directly...");
  // For nested mapping: sendLibrary[sender][eid]
  // Slot calculation: keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot_number)), key2))
  
  // First, we need to find the storage slot of sendLibrary mapping
  // Since it's internal, we can't know the exact slot, but we can try to read
  // using the contract's view function and compare
  
  // Actually, let's check what setSendLibrary is comparing against
  console.log("\n3. Testing setSendLibrary comparison...");
  const libraryToSet = ownEndpoint.sendUln302;
  console.log("   Library to set:", libraryToSet);
  
  // Try static call to see what it compares
  try {
    await endpoint.setSendLibrary.staticCall(
      baseOft.address,
      1315,
      libraryToSet
    );
    console.log("   ✅ Static call succeeded - library is NOT set to this value");
  } catch (e) {
    if (e.data) {
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        if (decoded.name === "LZ_SameValue") {
          console.log("   ❌ LZ_SameValue - library IS set to this value");
          console.log("   This means: sendLibrary[", baseOft.address, "][1315] == ", libraryToSet);
        }
      } catch {}
    }
  }

  // Check 4: Try reading with different methods
  console.log("\n4. Reading with getSendLibrary...");
  const [lib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  console.log("   getSendLibrary():", lib);
  console.log("   Expected:", libraryToSet);
  console.log("   Match:", lib.toLowerCase() === libraryToSet.toLowerCase() ? "✅" : "❌");
  
  if (lib === "0x0000000000000000000000000000000000000000") {
    console.log("\n   ⚠️  Contradiction detected!");
    console.log("   setSendLibrary says: library IS set");
    console.log("   getSendLibrary says: library is 0");
    console.log("\n   This suggests:");
    console.log("   - Different storage locations");
    console.log("   - View function bug");
    console.log("   - Or address/EID mismatch (but we verified they match)");
  }

  // Check 5: Try setting to DEFAULT_LIB first, then back
  console.log("\n5. Testing reset strategy...");
  console.log("   Strategy: Set to DEFAULT_LIB (address(0)), then set to library");
  console.log("   This might clear any inconsistent state");
  
  const [deployer] = await hre.ethers.getSigners();
  const delegate = await endpoint.delegates(baseOft.address);
  
  if (delegate.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("   ✅ Authorized to set library");
    console.log("   💡 Try running:");
    console.log("     1. Set to DEFAULT_LIB: endpoint.setSendLibrary(oapp, 1315, address(0))");
    console.log("     2. Set to library: endpoint.setSendLibrary(oapp, 1315, libraryAddress)");
  } else {
    console.log("   ❌ Not authorized");
  }
}

main().catch(console.error);
