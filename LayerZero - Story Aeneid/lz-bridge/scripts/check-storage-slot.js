/**
 * Check storage slot directly for sendLibrary mapping
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  console.log("🔍 Checking Storage Slot Directly");
  console.log("=".repeat(60));
  
  const endpointAddress = ownEndpoint.endpointV2;
  const oappAddress = baseOft.address;
  const eid = 1315;
  
  console.log("Endpoint:", endpointAddress);
  console.log("OApp:", oappAddress);
  console.log("EID:", eid, "\n");

  // In MessageLibManager, sendLibrary is an internal mapping
  // mapping(address sender => mapping(uint32 dstEid => address lib)) internal sendLibrary;
  
  // For nested mappings, storage slot is:
  // keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot)), key2))
  
  // We need to find the slot number for sendLibrary mapping
  // Since it's internal, we can't know the exact slot, but we can try common patterns
  
  // Actually, let's use a different approach - call the endpoint's internal state
  // by using a low-level call or checking events
  
  // Better approach: Let's check if we can call setSendLibrary with address(0) explicitly
  // to reset it to DEFAULT_LIB
  console.log("📝 Attempting to reset to DEFAULT_LIB (address(0))...");
  
  const endpoint = await hre.ethers.getContractAt("EndpointV2", endpointAddress);
  const [deployer] = await hre.ethers.getSigners();
  
  // Check delegate
  const delegate = await endpoint.delegates(oappAddress);
  console.log("OApp delegate:", delegate);
  console.log("Deployer:", deployer.address);
  console.log("Match:", delegate.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌\n");
  
  if (delegate.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ Not delegate, cannot set library");
    return;
  }
  
  // Try setting to address(0) - but wait, DEFAULT_LIB might not be address(0)
  // Let me check what DEFAULT_LIB actually is
  // From the code: address private constant DEFAULT_LIB = address(0);
  // So DEFAULT_LIB is address(0)
  
  // But we can't set it to address(0) directly via setSendLibrary because
  // setSendLibrary requires the library to be registered or DEFAULT_LIB
  // And DEFAULT_LIB is a special constant
  
  // Actually, looking at the modifier: onlyRegisteredOrDefault(_newLib)
  // This allows DEFAULT_LIB or registered libraries
  
  // Let's try a workaround: Check what happens if we try to read the storage
  // using eth_getStorageAt
  
  console.log("Checking via public getters...");
  const [lib1] = await endpoint.getSendLibrary(oappAddress, eid);
  const isDefault1 = await endpoint.isDefaultSendLibrary(oappAddress, eid);
  const defaultLib = await endpoint.defaultSendLibrary(eid);
  
  console.log("getSendLibrary():", lib1);
  console.log("isDefaultSendLibrary():", isDefault1);
  console.log("defaultSendLibrary():", defaultLib);
  
  // The contradiction:
  // - If sendLibrary[oapp][eid] == DEFAULT_LIB (address(0)), then:
  //   - isDefaultSendLibrary should return true
  //   - getSendLibrary should return defaultSendLibrary[eid]
  // - But we're seeing:
  //   - isDefaultSendLibrary returns false
  //   - getSendLibrary returns 0
  
  // This suggests sendLibrary[oapp][eid] might be set to something else
  // Let's try to explicitly set it to the library address, then check again
  
  console.log("\n📝 Setting to library address explicitly...");
  try {
    const tx = await endpoint.setSendLibrary(
      oappAddress,
      eid,
      ownEndpoint.sendUln302,
      { gasLimit: 500000 }
    );
    console.log("   Transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed at block:", receipt.blockNumber);
    
    // Wait a bit for state to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check again
    const [lib2] = await endpoint.getSendLibrary(oappAddress, eid);
    const isDefault2 = await endpoint.isDefaultSendLibrary(oappAddress, eid);
    
    console.log("\nAfter setting:");
    console.log("getSendLibrary():", lib2);
    console.log("isDefaultSendLibrary():", isDefault2);
    console.log("Expected:", ownEndpoint.sendUln302);
    console.log("Match:", lib2.toLowerCase() === ownEndpoint.sendUln302.toLowerCase() ? "✅" : "❌");
    
    if (lib2.toLowerCase() === ownEndpoint.sendUln302.toLowerCase()) {
      console.log("\n✅ Success! Send library is now set correctly");
      
      // Test quote
      console.log("\n🧪 Testing quote...");
      const messagingParams = {
        dstEid: eid,
        receiver: hre.ethers.zeroPadValue(deployer.address, 32),
        message: "0x",
        options: "0x",
        payInLzToken: false
      };
      
      try {
        const fee = await endpoint.quote(messagingParams, oappAddress);
        console.log("   ✅ Quote successful!");
        console.log("   Native fee:", hre.ethers.formatEther(fee.nativeFee), "ETH");
      } catch (e) {
        console.log("   ❌ Quote failed:", e.message);
        if (e.data) console.log("   Error data:", e.data);
      }
    }
  } catch (e) {
    console.error("   ❌ Failed:", e.message);
    if (e.data) {
      console.error("   Error data:", e.data);
      const errorInterface = new hre.ethers.Interface([
        "error LZ_SameValue()",
        "error LZ_Unauthorized()",
        "error LZ_UnsupportedEid()"
      ]);
      try {
        const decoded = errorInterface.parseError(e.data);
        console.log("   Decoded:", decoded.name);
      } catch {}
    }
  }
}

main().catch(console.error);
