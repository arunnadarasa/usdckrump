/**
 * Find the correct storage slot for sendLibrary mapping
 * by tracing what setSendLibrary actually writes to
 */
const hre = require("hardhat");
const fs = require("fs");

const LOG_PATH = "/Users/openclaw/Documents/USDC Krump/.cursor/debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7248/ingest/9209fc19-24df-4c24-a0d3-69a378d39154";

function logDebug(runId, hypothesisId, location, message, data) {
  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    location,
    message,
    data,
    runId,
    hypothesisId
  };
  
  fs.appendFileSync(LOG_PATH, JSON.stringify(logEntry) + "\n");
  
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry)
  }).catch(() => {});
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const runId = `run_${Date.now()}`;
  
  console.log("🔍 Finding Correct Storage Slot");
  console.log("=".repeat(60));
  
  // Strategy: Set library to a known value, then scan storage to find where it was written
  // But wait - we can't set it because it's already set (LZ_SameValue)
  
  // Alternative: Calculate storage slot based on Solidity storage layout rules
  // MessageLibManager inherits from Ownable, which has _owner at slot 0
  // But EndpointV2 also inherits from multiple contracts
  
  // Let's check the actual storage layout by reading known values
  console.log("1. Checking contract storage layout...");
  
  // Read slot 0 (should be owner from Ownable)
  const slot0 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 0);
  const owner = "0x" + slot0.slice(-40);
  logDebug(runId, "G", "find-correct-storage-slot.js:45", "Slot 0 (owner)", {
    slot0,
    owner,
    expectedOwner: deployer.address.toLowerCase()
  });
  console.log("   Slot 0 (owner):", owner);
  
  // EndpointV2 adds: lzToken, delegates mapping
  // MessageLibManager adds: registeredLibraries array, isRegisteredLibrary mapping, sendLibrary mapping
  
  // Storage layout estimation:
  // slot 0: _owner (from Ownable)
  // slot 1: lzToken (from EndpointV2)
  // slot 2: registeredLibraries.length (array)
  // slot 3+: registeredLibraries elements
  // slot N: isRegisteredLibrary mapping base
  // slot N+1: sendLibrary mapping base <- we need this
  
  // For nested mapping: sendLibrary[sender][dstEid]
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(sender, baseSlot)), dstEid))
  
  // Try to find sendLibrary base slot by checking where registeredLibraries ends
  // registeredLibraries should have at least 1 element (blockedLibrary)
  
  console.log("\n2. Finding sendLibrary base slot...");
  
  // Check slot 2 for array length
  const slot2 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 2);
  const arrayLength = BigInt(slot2);
  logDebug(runId, "G", "find-correct-storage-slot.js:70", "Array length at slot 2", {
    slot2,
    arrayLength: arrayLength.toString()
  });
  console.log("   Slot 2 (array length):", arrayLength.toString());
  
  // Array elements start at keccak256(abi.encode(2))
  // Then isRegisteredLibrary mapping starts after array
  // sendLibrary mapping starts after isRegisteredLibrary
  
  // Actually, mappings don't use sequential slots - they use keccak256
  // So sendLibrary base slot could be anywhere
  
  // Better approach: Use Solidity's storage layout
  // We know sendLibrary is defined as: mapping(address => mapping(uint32 => address))
  // In Solidity, nested mappings use: keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot)), key2))
  
  // Let's try to find it by checking if we can read the value that setSendLibrary thinks is there
  // Since setSendLibrary says LZ_SameValue, it means sendLibrary[oapp][eid] == newLib
  
  console.log("\n3. Testing storage slot calculation with different base slots...");
  
  const oapp = baseOft.address.toLowerCase();
  const eid = 1315;
  const expectedLib = ownEndpoint.sendUln302.toLowerCase();
  
  // Try base slots from 0 to 10
  for (let baseSlot = 0; baseSlot <= 10; baseSlot++) {
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
      
      logDebug(runId, "G", "find-correct-storage-slot.js:100", `Storage at base slot ${baseSlot}`, {
        baseSlot,
        calculatedSlot: storageSlot,
        storageValue,
        storageAsAddress,
        expectedLib,
        match: storageAsAddress === expectedLib
      });
      
      if (storageAsAddress === expectedLib) {
        console.log(`   ✅ FOUND! Base slot: ${baseSlot}`);
        console.log(`   Storage slot: ${storageSlot}`);
        console.log(`   Value: ${storageAsAddress}`);
        console.log(`   Expected: ${expectedLib}`);
        console.log(`   Match: ✅`);
        break;
      }
    } catch (e) {
      // Skip errors
    }
  }
  
  // Also check: Maybe the issue is that getSendLibrary reads from a different slot
  // than setSendLibrary writes to
  
  console.log("\n4. Checking if getSendLibrary uses different slot calculation...");
  
  // The getSendLibrary code is:
  // lib = sendLibrary[_sender][_dstEid];
  // This should use the same slot calculation as setSendLibrary
  
  // But wait - what if there's a difference in how the address is passed?
  // setSendLibrary uses _oapp parameter
  // getSendLibrary uses _sender parameter
  
  // Let's check if they're using the same address format
  logDebug(runId, "G", "find-correct-storage-slot.js:125", "Address format check", {
    oappUsed: oapp,
    oappOriginal: baseOft.address,
    oappLowercase: baseOft.address.toLowerCase(),
    oappChecksum: baseOft.address
  });
  
  console.log("\n5. Testing actual getSendLibrary return value type...");
  
  try {
    const result = await endpoint.getSendLibrary(baseOft.address, 1315);
    // Check if result is an array (ethers v6) or single value (ethers v5)
    const lib = Array.isArray(result) ? result[0] : result;
    
    logDebug(runId, "G", "find-correct-storage-slot.js:138", "getSendLibrary return type", {
      resultType: typeof result,
      isArray: Array.isArray(result),
      lib,
      libType: typeof lib,
      libLength: lib ? lib.length : 0,
      libIsZeroString: lib === "0",
      libIsZeroAddress: lib === "0x0000000000000000000000000000000000000000"
    });
    
    console.log("   Result type:", typeof result);
    console.log("   Is array:", Array.isArray(result));
    console.log("   Lib value:", lib);
    console.log("   Lib type:", typeof lib);
    
    // Check if it's actually returning address(0) but being converted incorrectly
    if (lib === "0" || lib === "0x0" || lib === "0x0000000000000000000000000000000000000000") {
      console.log("   ⚠️  Library is zero address");
    }
  } catch (e) {
    logDebug(runId, "G", "find-correct-storage-slot.js:155", "getSendLibrary error", {
      error: e.message
    });
  }
  
  console.log("\n📋 Analysis complete. Check logs for details.");
}

main().catch(console.error);
