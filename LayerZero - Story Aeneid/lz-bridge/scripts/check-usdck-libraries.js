const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));
  const baseEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-latest.json", "utf8"));
  
  const baseProvider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
  const endpoint = new hre.ethers.Contract(
    baseEndpoint.endpointV2,
    [
      "function defaultSendLibrary(uint32 eid) view returns (address)",
      "function getSendLibrary(address oapp, uint32 eid) view returns (address)",
      "function isDefaultSendLibrary(address oapp, uint32 eid) view returns (bool)",
    ],
    baseProvider
  );

  console.log("🔍 Checking send library for USDCKrumpOFT → Story Aeneid (EID 1315)\n");
  console.log("OFT:", baseOft.address);
  console.log("Endpoint:", baseEndpoint.endpointV2, "\n");

  try {
    const defaultLib = await endpoint.defaultSendLibrary(1315);
    console.log("Default send library (EID 1315):", defaultLib);
    
    const oappLib = await endpoint.getSendLibrary(baseOft.address, 1315);
    console.log("OApp send library (EID 1315):", oappLib);
    
    const isDefault = await endpoint.isDefaultSendLibrary(baseOft.address, 1315);
    console.log("Using default:", isDefault);

    if (defaultLib === "0x0000000000000000000000000000000000000000" && oappLib === "0x0000000000000000000000000000000000000000") {
      console.log("\n❌ No send library configured!");
      console.log("   Need to configure send library for EID 1315");
    } else {
      console.log("\n✅ Send library configured");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
