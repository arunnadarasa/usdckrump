/**
 * Calculate the exact storage slot for sendLibrary[oapp][eid]
 * using Solidity storage layout rules
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  console.log("🔍 Calculating sendLibrary storage slot\n");

  const oapp = baseOft.address.toLowerCase();
  const eid = 1315;
  const expectedLib = ownEndpoint.sendUln302.toLowerCase();

  // MessageLibManager storage layout (inherited by EndpointV2):
  // EndpointV2 inherits from: MessagingChannel, MessageLibManager, MessagingComposer, MessagingContext
  // 
  // MessagingChannel: eid (uint32) at slot 0
  // MessageLibManager:
  //   - blockedLibrary (immutable, no slot)
  //   - registeredLibraries[] at slot 1 (after eid)
  //   - isRegisteredLibrary mapping at slot 2
  //   - sendLibrary mapping at slot 3
  //   - receiveLibrary mapping at slot 4
  //   - receiveLibraryTimeout mapping at slot 5
  //   - defaultSendLibrary mapping at slot 6
  //   - defaultReceiveLibrary mapping at slot 7
  //   - defaultReceiveLibraryTimeout mapping at slot 8

  // But wait - EndpointV2 also has:
  // - lzToken at slot after MessagingChannel
  // - delegates mapping

  // Let's check the actual storage layout by reading known values
  console.log("1. Reading storage slots to determine layout:\n");

  // Slot 0 should be eid (from MessagingChannel)
  const slot0 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 0);
  console.log("   Slot 0:", slot0);
  const eidFromStorage = Number(BigInt(slot0));
  console.log("   EID from storage:", eidFromStorage);

  // Slot 1 might be lzToken or registeredLibraries.length
  const slot1 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 1);
  console.log("   Slot 1:", slot1);

  // For nested mapping sendLibrary[sender][dstEid]:
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(sender, baseSlot)), dstEid))

  // Try base slots from 2 to 10
  console.log("\n2. Testing storage slot calculation:\n");

  for (let baseSlot = 2; baseSlot <= 10; baseSlot++) {
    try {
      // Calculate storage slot
      const innerHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["address", "uint256"], [oapp, baseSlot])
      );
      const storageSlot = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["bytes32", "uint32"], [innerHash, eid])
      );

      const storageValue = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, storageSlot);
      const storageAsAddress = "0x" + storageValue.slice(-40).toLowerCase();

      if (storageAsAddress === expectedLib) {
        console.log(`   ✅ FOUND at base slot ${baseSlot}!`);
        console.log(`      Storage slot: ${storageSlot}`);
        console.log(`      Value: ${storageAsAddress}`);
        console.log(`      Expected: ${expectedLib}`);
        console.log(`\n   This confirms sendLibrary IS stored correctly`);
        console.log(`   The issue must be in getSendLibrary() reading from wrong slot`);
        return;
      } else if (storageValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`   Base slot ${baseSlot}: ${storageAsAddress} (not empty)`);
      }
    } catch (e) {
      // Skip
    }
  }

  console.log("\n❌ Could not find storage slot");
  console.log("   This suggests either:");
  console.log("   1. Storage slot calculation is wrong");
  console.log("   2. The value is stored in a different location");
  console.log("   3. There's a proxy/implementation mismatch");
}

main().catch(console.error);
