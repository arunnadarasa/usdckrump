/**
 * Find the exact storage slot where sendLibrary[oapp][eid] is stored
 * by checking what setSendLibrary actually wrote to
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);
  const [deployer] = await hre.ethers.getSigners();

  console.log("🔍 Finding sendLibrary storage slot\n");

  const oapp = baseOft.address.toLowerCase();
  const eid = 1315;
  const expectedLib = ownEndpoint.sendUln302.toLowerCase();

  // MessageLibManager storage layout:
  // slot 0: _owner (from Ownable)
  // slot 1: lzToken (from EndpointV2)
  // slot 2: registeredLibraries.length
  // slot 3+: registeredLibraries elements
  // slot N: isRegisteredLibrary mapping base
  // slot N+1: sendLibrary mapping base <- we need this

  // For nested mapping sendLibrary[sender][dstEid]:
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(sender, baseSlot)), dstEid))

  // Try to find the base slot by checking where sendLibrary mapping starts
  // Since we know setSendLibrary wrote the value, let's try different base slots

  console.log("Testing storage slot calculation...\n");

  // Check slot 2 for array length first
  const slot2 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 2);
  const arrayLength = BigInt(slot2);
  console.log("Slot 2 (registeredLibraries.length):", arrayLength.toString());

  // Array elements start at keccak256(abi.encode(2))
  // After array, mappings start
  // But mappings don't use sequential slots - they use keccak256

  // Try base slots from 3 to 10 (after array)
  let foundSlot = null;
  for (let baseSlot = 3; baseSlot <= 10; baseSlot++) {
    try {
      // Calculate storage slot for sendLibrary[oapp][eid]
      const innerHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["address", "uint256"], [oapp, baseSlot])
      );
      const storageSlot = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["bytes32", "uint32"], [innerHash, eid])
      );

      const storageValue = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, storageSlot);
      const storageAsAddress = "0x" + storageValue.slice(-40).toLowerCase();

      if (storageAsAddress === expectedLib) {
        console.log(`✅ FOUND! Base slot: ${baseSlot}`);
        console.log(`   Storage slot: ${storageSlot}`);
        console.log(`   Value: ${storageAsAddress}`);
        console.log(`   Expected: ${expectedLib}`);
        foundSlot = { baseSlot, storageSlot, value: storageAsAddress };
        break;
      } else if (storageValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`   Base slot ${baseSlot}: ${storageAsAddress} (not empty, but not match)`);
      }
    } catch (e) {
      // Skip errors
    }
  }

  if (!foundSlot) {
    console.log("\n❌ Could not find storage slot with expected value");
    console.log("   This suggests the storage slot calculation might be wrong");
    console.log("   OR the value is stored differently than expected");
    
    // Try reading what getSendLibrary returns vs what's in storage
    console.log("\nComparing getSendLibrary() vs direct storage read:");
    const libFromFunction = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   getSendLibrary():", libFromFunction);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", libFromFunction.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
  } else {
    console.log("\n✅ Storage slot found!");
    console.log("   This confirms the library IS stored correctly");
    console.log("   The issue must be in how getSendLibrary() reads it");
  }
}

main().catch(console.error);
