/**
 * Full debugging script for send library issue
 * Tests multiple hypotheses with detailed logging
 */
const hre = require("hardhat");
const fs = require("fs");

// Logging configuration
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
  
  // Write to file (NDJSON format)
  fs.appendFileSync(LOG_PATH, JSON.stringify(logEntry) + "\n");
  
  // Also send via HTTP (non-blocking)
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
  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  const runId = `run_${Date.now()}`;
  
  console.log("🔍 Full Debug: Send Library Issue");
  console.log("=".repeat(60));
  console.log("Endpoint:", ownEndpoint.endpointV2);
  console.log("OApp:", baseOft.address);
  console.log("EID: 1315");
  console.log("Library:", ownEndpoint.sendUln302);
  console.log("Run ID:", runId, "\n");

  // HYPOTHESIS A: Address encoding mismatch (checksum vs lowercase)
  console.log("Testing Hypothesis A: Address encoding mismatch...");
  const oappLower = baseOft.address.toLowerCase();
  const oappChecksum = baseOft.address;
  const libLower = ownEndpoint.sendUln302.toLowerCase();
  const libChecksum = ownEndpoint.sendUln302;
  
  logDebug(runId, "A", "debug-send-library-full.js:45", "Address comparison", {
    oappLower,
    oappChecksum,
    libLower,
    libChecksum,
    oappMatch: oappLower === oappChecksum.toLowerCase(),
    libMatch: libLower === libChecksum.toLowerCase()
  });
  console.log("   ✅ Logged address encodings\n");
  
  // HYPOTHESIS B: Storage slot calculation issue
  console.log("Testing Hypothesis B: Storage slot calculation...");
  
  const eid = 1315;
  const eidPadded = hre.ethers.zeroPadValue(hre.ethers.toBeHex(eid), 32);
  const oappPadded = hre.ethers.zeroPadValue(oappLower, 32);
  
  logDebug(runId, "B", "debug-send-library-full.js:65", "Storage slot calculation inputs", {
    eid,
    eidPadded,
    oappPadded,
    oappAddress: oappLower
  });
  
  // Calculate storage slot for sendLibrary[oapp][eid]
  // sendLibrary is a nested mapping: mapping(address => mapping(uint32 => address))
  // Storage slot calculation for nested mapping:
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot_number)), key2))
  
  // Try different possible slot numbers for sendLibrary mapping
  // MessageLibManager storage layout (estimated):
  // slot 0: registeredLibraries (array)
  // slot 1: isRegisteredLibrary (mapping)
  // slot 2: sendLibrary (mapping) <- most likely
  // slot 3: receiveLibrary (mapping)
  
  const possibleSlots = [2n, 3n, 4n, 5n];
  
  for (const baseSlot of possibleSlots) {
    try {
      // Calculate: keccak256(abi.encodePacked(keccak256(abi.encode(oapp, baseSlot)), eid))
      const innerHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["address", "uint256"], [oappLower, baseSlot])
      );
      const storageSlot = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["bytes32", "uint32"], [innerHash, eid])
      );
      
      const storageValue = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, storageSlot);
      const storageAsAddress = "0x" + storageValue.slice(-40);
      
      logDebug(runId, "B", "debug-send-library-full.js:95", `Storage read at slot ${baseSlot}`, {
        baseSlot: baseSlot.toString(),
        calculatedSlot: storageSlot,
        storageValue,
        storageAsAddress,
        expectedLib: ownEndpoint.sendUln302,
        match: storageAsAddress.toLowerCase() === libLower,
        isEmpty: storageValue === "0x0000000000000000000000000000000000000000000000000000000000000000"
      });
      
      if (storageAsAddress.toLowerCase() === libLower) {
        console.log(`   ✅ Found library at base slot ${baseSlot}!`);
        console.log(`   Storage slot: ${storageSlot}`);
        console.log(`   Value: ${storageAsAddress}`);
        console.log(`   This confirms storage IS set correctly`);
      }
    } catch (e) {
      logDebug(runId, "B", "debug-send-library-full.js:110", `Storage read error at slot ${baseSlot}`, {
        baseSlot: baseSlot.toString(),
        error: e.message
      });
    }
  }
  console.log("   ✅ Tested multiple storage slots\n");
  
  // HYPOTHESIS C: View function execution context
  console.log("Testing Hypothesis C: View function execution context...");
  
  try {
    const [lib1] = await endpoint.getSendLibrary(baseOft.address, 1315);
    const isDefault1 = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    const defaultLib1 = await endpoint.defaultSendLibrary(1315);
    
    logDebug(runId, "C", "debug-send-library-full.js:125", "getSendLibrary result", {
      lib: lib1,
      libIsZero: lib1 === "0x0000000000000000000000000000000000000000",
      isDefault: isDefault1,
      defaultLib: defaultLib1,
      expectedLib: ownEndpoint.sendUln302,
      match: lib1.toLowerCase() === libLower
    });
    
    console.log("   getSendLibrary():", lib1);
    console.log("   isDefaultSendLibrary():", isDefault1);
    console.log("   defaultSendLibrary():", defaultLib1);
  } catch (e) {
    logDebug(runId, "C", "debug-send-library-full.js:138", "getSendLibrary error", {
      error: e.message,
      data: e.data
    });
  }
  console.log("   ✅ Tested view functions\n");
  
  // HYPOTHESIS D: setSendLibrary comparison check
  console.log("Testing Hypothesis D: setSendLibrary comparison...");
  
  try {
    await endpoint.setSendLibrary.staticCall(baseOft.address, 1315, ownEndpoint.sendUln302);
    logDebug(runId, "D", "debug-send-library-full.js:149", "setSendLibrary staticCall succeeded", {
      meaning: "Library is NOT set to this value",
      contradiction: "But earlier tests showed LZ_SameValue"
    });
    console.log("   ⚠️  Static call succeeded (no LZ_SameValue)");
  } catch (e) {
    if (e.data) {
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        if (decoded.name === "LZ_SameValue") {
          logDebug(runId, "D", "debug-send-library-full.js:160", "setSendLibrary says LZ_SameValue", {
            meaning: "Library IS set to this value",
            contradiction: "But getSendLibrary returns 0",
            check: "Line 235: if (sendLibrary[_oapp][_eid] == _newLib) revert Errors.LZ_SameValue();"
          });
          console.log("   ✅ Confirmed: LZ_SameValue error");
          console.log("   This means: sendLibrary[oapp][eid] == newLib");
        } else {
          logDebug(runId, "D", "debug-send-library-full.js:169", "setSendLibrary different error", {
            errorName: decoded.name,
            errorData: e.data
          });
        }
      } catch {}
    }
  }
  console.log("   ✅ Tested setSendLibrary comparison\n");
  
  // HYPOTHESIS E: DEFAULT_LIB constant comparison
  console.log("Testing Hypothesis E: DEFAULT_LIB constant check...");
  
  const DEFAULT_LIB = "0x0000000000000000000000000000000000000000";
  const [currentLib] = await endpoint.getSendLibrary(baseOft.address, 1315);
  const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
  
  logDebug(runId, "E", "debug-send-library-full.js:183", "DEFAULT_LIB comparison", {
    DEFAULT_LIB,
    currentLib,
    currentLibIsZero: currentLib === "0x0000000000000000000000000000000000000000",
    isDefault,
    contradiction: currentLib === DEFAULT_LIB && !isDefault ? "YES - currentLib is 0 but isDefault is false" : "NO"
  });
  
  console.log("   DEFAULT_LIB:", DEFAULT_LIB);
  console.log("   currentLib:", currentLib);
  console.log("   isDefault:", isDefault);
  if (currentLib === DEFAULT_LIB && !isDefault) {
    console.log("   ⚠️  CONTRADICTION: lib is 0 but isDefault is false!");
  }
  console.log("   ✅ Tested DEFAULT_LIB comparison\n");
  
  // HYPOTHESIS F: Try reading with different address formats
  console.log("Testing Hypothesis F: Different address formats...");
  
  const addressVariants = [
    baseOft.address, // Original (checksummed)
    baseOft.address.toLowerCase(), // Lowercase
    hre.ethers.getAddress(baseOft.address), // Normalized
  ];
  
  for (const addr of addressVariants) {
    try {
      const [lib] = await endpoint.getSendLibrary(addr, 1315);
      const isDef = await endpoint.isDefaultSendLibrary(addr, 1315);
      
      logDebug(runId, "F", "debug-send-library-full.js:205", "getSendLibrary with address variant", {
        address: addr,
        addressType: addr === baseOft.address ? "checksummed" : addr === baseOft.address.toLowerCase() ? "lowercase" : "normalized",
        lib,
        isDefault: isDef,
        match: lib.toLowerCase() === libLower
      });
      
      if (lib.toLowerCase() === libLower) {
        console.log(`   ✅ Found correct library with address variant: ${addr === baseOft.address ? "checksummed" : "lowercase"}`);
      }
    } catch (e) {
      logDebug(runId, "F", "debug-send-library-full.js:216", "getSendLibrary error with variant", {
        address: addr,
        error: e.message
      });
    }
  }
  console.log("   ✅ Tested different address formats\n");
  
  // Summary
  console.log("📋 Debug Summary:");
  console.log("   All hypotheses tested and logged");
  console.log("   Log file:", LOG_PATH);
  console.log("\n💡 Next: Analyze logs to identify root cause");
}

main().catch((e) => {
  console.error("❌ Debug script failed:", e.message);
  process.exit(1);
});
