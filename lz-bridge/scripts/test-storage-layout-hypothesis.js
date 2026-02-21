/**
 * Test hypothesis: Storage layout issue with nested mapping in inheritance
 * The sendLibrary mapping might be at a different slot than expected
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
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  const endpoint = await hre.ethers.getContractAt("EndpointV2", ownEndpoint.endpointV2);

  const runId = `run_${Date.now()}`;

  console.log("🔍 Testing Storage Layout Hypothesis\n");

  // Storage layout for EndpointV2 inheritance:
  // EndpointV2: MessagingChannel, MessageLibManager, MessagingComposer, MessagingContext
  // 
  // MessagingChannel: eid (uint32) - but this is set in constructor, might be at slot 0
  // MessageLibManager inherits Ownable: _owner at slot 0
  // EndpointV2 adds: lzToken, delegates mapping
  
  // The issue: sendLibrary mapping is in MessageLibManager
  // But EndpointV2 also has storage variables
  
  console.log("1. Checking storage slots:\n");
  
  // Slot 0: Should be _owner (from Ownable via MessageLibManager)
  const slot0 = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, 0);
  const owner = await endpoint.owner();
  logDebug(runId, "J", "test-storage-layout-hypothesis.js:50", "Slot 0 check", {
    slot0,
    ownerFromContract: owner,
    slot0AsAddress: "0x" + slot0.slice(-40),
    match: owner.toLowerCase() === ("0x" + slot0.slice(-40)).toLowerCase()
  });
  console.log("   Slot 0:", slot0);
  console.log("   Owner:", owner);
  console.log("   Match:", owner.toLowerCase() === ("0x" + slot0.slice(-40)).toLowerCase());

  // Check eid (from MessagingChannel)
  const eid = await endpoint.eid();
  console.log("\n2. EID from contract:", eid.toString());
  
  // Check lzToken (from EndpointV2)
  const lzToken = await endpoint.lzToken();
  console.log("3. lzToken:", lzToken);

  // Now, the sendLibrary mapping is defined in MessageLibManager
  // It's: mapping(address sender => mapping(uint32 dstEid => address lib)) internal sendLibrary;
  // 
  // For nested mappings, Solidity uses:
  // slot = keccak256(abi.encodePacked(keccak256(abi.encode(sender, baseSlot)), dstEid))
  //
  // The base slot for sendLibrary needs to be determined based on inheritance order
  
  console.log("\n4. Testing different base slots for sendLibrary mapping:\n");
  
  const oapp = baseOft.address.toLowerCase();
  const expectedLib = ownEndpoint.sendUln302.toLowerCase();
  const dstEid = 1315;
  
  // Try base slots from 1 to 10
  // After slot 0 (_owner), we have:
  // - eid might be packed with owner or at slot 1
  // - registeredLibraries array
  // - isRegisteredLibrary mapping
  // - sendLibrary mapping <- we need this
  
  let foundSlot = null;
  for (let baseSlot = 1; baseSlot <= 15; baseSlot++) {
    try {
      // Calculate storage slot for sendLibrary[oapp][dstEid]
      const innerHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["address", "uint256"], [oapp, baseSlot])
      );
      const storageSlot = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["bytes32", "uint32"], [innerHash, dstEid])
      );

      const storageValue = await hre.ethers.provider.getStorage(ownEndpoint.endpointV2, storageSlot);
      const storageAsAddress = "0x" + storageValue.slice(-40).toLowerCase();

      logDebug(runId, "J", "test-storage-layout-hypothesis.js:95", `Storage at base slot ${baseSlot}`, {
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
        foundSlot = { baseSlot, storageSlot, value: storageAsAddress };
        break;
      }
    } catch (e) {
      // Skip errors
    }
  }

  if (foundSlot) {
    console.log("\n✅ Storage slot found!");
    console.log("   This confirms the library IS stored correctly");
    console.log("   Base slot:", foundSlot.baseSlot);
    
    // Now test if getSendLibrary() reads from the same slot
    console.log("\n5. Verifying getSendLibrary() reads from correct slot:");
    const libFromFunction = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("   getSendLibrary():", libFromFunction);
    console.log("   Expected:", ownEndpoint.sendUln302);
    console.log("   Match:", libFromFunction.toLowerCase() === ownEndpoint.sendUln302.toLowerCase());
    
    logDebug(runId, "J", "test-storage-layout-hypothesis.js:125", "getSendLibrary comparison", {
      libFromFunction,
      expectedLib: ownEndpoint.sendUln302,
      storageSlot: foundSlot.storageSlot,
      storageValue: foundSlot.value,
      match: libFromFunction.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()
    });
    
    if (libFromFunction.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n   ✅ getSendLibrary() reads correctly!");
      console.log("   This means the issue is NOT storage layout");
      console.log("   The issue must be in how quote() calls getSendLibrary() internally");
    }
  } else {
    console.log("\n❌ Could not find storage slot");
    console.log("   This suggests the storage layout might be different than expected");
  }

  console.log("\n📋 Analysis complete. Check logs for details.");
}

main().catch(console.error);
