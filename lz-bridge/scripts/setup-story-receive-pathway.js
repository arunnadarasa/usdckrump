const hre = require("hardhat");
const fs = require("fs");

/**
 * Configure Story Aeneid to receive messages from Base Sepolia:
 * 1. Set default ULN config on ReceiveUln302 for Base Sepolia source EID (with one DVN)
 * 2. Set default receive library on EndpointV2 for that EID
 *
 * Base Sepolia: we use chain ID 84532 as source EID (packet srcEid from Base may be 40245
 * per LayerZero docs; if so, run again with EID_84532=false and EID_40245=true or configure both).
 *
 * Optional: set BASE_SEPOLIA_DVN in .env to use a specific DVN; otherwise uses a testnet LZDeadDVN.
 */
const BASE_SEPOLIA_EID = 84532; // source EID when receiving from Base Sepolia (chain ID)
const LZ_TESTNET_DEAD_DVN = "0x55c175DD5b039331dB251424538169D8495C18d1"; // used on several testnets

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid (chainId 1315)");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const storyInfra = JSON.parse(
    fs.readFileSync("deployments/story-aeneid-latest.json", "utf8")
  );

  const dvnAddress = process.env.BASE_SEPOLIA_DVN || LZ_TESTNET_DEAD_DVN;
  const dvnAddressSorted = [hre.ethers.getAddress(dvnAddress)]; // single DVN, already "sorted"

  console.log("🔧 Story Aeneid receive pathway setup (Base Sepolia → Story Aeneid)\n");
  console.log("   ReceiveUln302:", storyInfra.receiveUln302);
  console.log("   EndpointV2:", storyInfra.endpointV2);
  console.log("   Source EID (Base Sepolia):", BASE_SEPOLIA_EID);
  console.log("   DVN (1 required):", dvnAddressSorted[0], "\n");

  const receiveUln = await hre.ethers.getContractAt(
    "ReceiveUln302",
    storyInfra.receiveUln302
  );
  const endpoint = await hre.ethers.getContractAt(
    "EndpointV2",
    storyInfra.endpointV2
  );

  const ownerReceive = await receiveUln.owner();
  const ownerEndpoint = await endpoint.owner();
  if (ownerReceive.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not ReceiveUln302 owner");
    process.exit(1);
  }
  if (ownerEndpoint.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not EndpointV2 owner");
    process.exit(1);
  }

  const isSupported = await receiveUln.isSupportedEid(BASE_SEPOLIA_EID);
  if (isSupported) {
    console.log("✅ ReceiveUln302 already has default ULN config for EID", BASE_SEPOLIA_EID);
  } else {
    console.log("1/2 Setting default ULN config on ReceiveUln302 for EID", BASE_SEPOLIA_EID);
    const ulnConfig = {
      confirmations: 1n,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: dvnAddressSorted,
      optionalDVNs: [],
    };
    const params = [{ eid: BASE_SEPOLIA_EID, config: ulnConfig }];
    const tx1 = await receiveUln.setDefaultUlnConfigs(params);
    await tx1.wait();
    console.log("   Tx:", tx1.hash);
    console.log("   Done.\n");
  }

  const currentLib = await endpoint.defaultReceiveLibrary(BASE_SEPOLIA_EID);
  if (currentLib.toLowerCase() === storyInfra.receiveUln302.toLowerCase()) {
    console.log("✅ Endpoint already has default receive library for EID", BASE_SEPOLIA_EID);
  } else {
    console.log("2/2 Setting default receive library on EndpointV2 for EID", BASE_SEPOLIA_EID);
    const tx2 = await endpoint.setDefaultReceiveLibrary(
      BASE_SEPOLIA_EID,
      storyInfra.receiveUln302,
      0
    );
    await tx2.wait();
    console.log("   Tx:", tx2.hash);
    console.log("   Done.\n");
  }

  console.log("✅ Story Aeneid receive pathway configured for Base Sepolia (EID " + BASE_SEPOLIA_EID + ").");
  console.log("   If LayerZero uses EID 40245 for Base Sepolia, run again with BASE_SEPOLIA_EID=40245 or add a second config.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
