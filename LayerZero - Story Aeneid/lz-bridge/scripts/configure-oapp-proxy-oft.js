const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("⚙️  Configuring OAppProxyOFT with LayerZero libraries\n");

  const network = await hre.ethers.provider.getNetwork();
  const [signer] = await hre.ethers.getSigners();

  // Load deployment
  const deployment = JSON.parse(
    fs.readFileSync(`deployments/oapp-proxy-oft-${network.name}-latest.json`, "utf8")
  );

  console.log("Network:", network.name);
  console.log("OAppProxyOFT:", deployment.oappProxyOft);
  console.log("Endpoint:", deployment.endpoint);
  console.log("Signer:", signer.address);

  const proxyOft = await hre.ethers.getContractAt(
    "OAppProxyOFT",
    deployment.oappProxyOft
  );
  const endpoint = await hre.ethers.getContractAt(
    "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol:ILayerZeroEndpointV2",
    deployment.endpoint
  );

  // Load LayerZero infrastructure deployments
  let sendLib, receiveLib;
  
  if (network.chainId === 84532n) {
    // Base Sepolia - prefer self-deployed libraries if using self-deployed endpoint
    try {
      const infraDeployment = JSON.parse(
        fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8")
      );
      // Check if we're using self-deployed endpoint
      if (deployment.endpoint.toLowerCase() === infraDeployment.endpointV2.toLowerCase()) {
        // Using self-deployed endpoint - use self-deployed libraries
        sendLib = infraDeployment.sendUln302;
        receiveLib = infraDeployment.receiveUln302;
        console.log("   Using self-deployed libraries (self-deployed endpoint detected):");
        console.log("   SendUln302:", sendLib);
        console.log("   ReceiveUln302:", receiveLib);
      } else {
        // Using official endpoint - use official libraries
        sendLib = infraDeployment.officialSendUln302 || "0xC1868e054425D378095A003EcbA3823a5D0135C9";
        receiveLib = infraDeployment.officialReceiveUln302 || "0x12523de19dc41c91F7d2093E0CFbB76b17012C8d";
        console.log("   Using official LayerZero libraries:");
        console.log("   SendUln302:", sendLib);
        console.log("   ReceiveUln302:", receiveLib);
      }
    } catch (e) {
      sendLib = process.env.BASE_SEPOLIA_SEND_LIB || "0xC1868e054425D378095A003EcbA3823a5D0135C9";
      receiveLib = process.env.BASE_SEPOLIA_RECEIVE_LIB || "0x12523de19dc41c91F7d2093E0CFbB76b17012C8d";
      console.log("   Using default official LayerZero libraries:");
      console.log("   SendUln302:", sendLib);
      console.log("   ReceiveUln302:", receiveLib);
    }
  } else if (network.chainId === 1315n) {
    // Story Aeneid - use self-deployed libraries
    try {
      const infraDeployment = JSON.parse(
        fs.readFileSync("deployments/story-aeneid-latest.json", "utf8")
      );
      sendLib = infraDeployment.sendUln302;
      receiveLib = infraDeployment.receiveUln302;
      console.log("   Using self-deployed libraries:");
      console.log("   SendUln302:", sendLib);
      console.log("   ReceiveUln302:", receiveLib);
    } catch (e) {
      // Fallback to environment variables
      sendLib = process.env.STORY_AENEID_SEND_LIB || "0xB00b22e8D0E8840B979B899Eb125b5db3C0E4aA2";
      receiveLib = process.env.STORY_AENEID_RECEIVE_LIB || "0xbcBe64F771027571573e88750BE19F487e9c9F68";
      console.log("   Using default Story Aeneid libraries:");
      console.log("   SendUln302:", sendLib);
      console.log("   ReceiveUln302:", receiveLib);
    }
  }

  const BASE_SEPOLIA_EID = 40245;
  const STORY_AENEID_EID = 1315;

  // Determine peer EID based on current network
  // When on Base Sepolia: send TO and receive FROM Story Aeneid (1315)
  // When on Story Aeneid: send TO and receive FROM Base Sepolia (40245)
  const peerEid = network.chainId === 84532n ? STORY_AENEID_EID : BASE_SEPOLIA_EID;
  const dstEid = peerEid; // Destination for sending
  const srcEid = peerEid; // Source for receiving (messages come from peer)

  // Check if OAppProxyOFT is a delegate
  console.log("\n🔍 Checking delegate status...");
  let isDelegate = false;
  try {
    isDelegate = await endpoint.delegates(deployment.oappProxyOft);
    if (isDelegate) {
      console.log("   ✅ OAppProxyOFT is a delegate - can configure libraries");
    } else {
      console.log("   ⚠️  OAppProxyOFT is not a delegate");
      console.log("   📝 Run: npm run setup:proxy-oft-delegate -- --network", network.name);
      console.log("   Or configure libraries manually via endpoint owner");
    }
  } catch (error) {
    console.log("   ⚠️  Could not check delegate status:", error.message);
    console.log("   Attempting configuration anyway...");
  }

  console.log("\n📚 Configuring libraries...");

  // Configure libraries via endpoint
  // Note: This requires OAppProxyOFT to be a delegate OR endpoint owner to call
  try {
    // Set send library
    console.log(`Setting send library for EID ${dstEid}...`);
    const tx1 = await endpoint.setSendLibrary(
      deployment.oappProxyOft,
      dstEid,
      sendLib
    );
    await tx1.wait();
    console.log("   ✅ Send library set");
  } catch (error) {
    console.log("   ❌ Failed to set send library:", error.message);
    if (error.message.includes("execution reverted")) {
      console.log("   💡 OAppProxyOFT may need to be set as delegate first:");
      console.log("      npm run setup:proxy-oft-delegate -- --network", network.name);
      console.log("   Or configure manually via endpoint owner");
    }
    throw error;
  }

  try {
    // Set receive library
    console.log(`Setting receive library for EID ${srcEid}...`);
    const tx2 = await endpoint.setReceiveLibrary(
      deployment.oappProxyOft,
      srcEid,
      receiveLib,
      0 // grace period
    );
    await tx2.wait();
    console.log("   ✅ Receive library set");
  } catch (error) {
    console.log("   ❌ Failed to set receive library:", error.message);
    if (error.message.includes("execution reverted")) {
      console.log("   💡 OAppProxyOFT may need to be set as delegate first:");
      console.log("      npm run setup:proxy-oft-delegate -- --network", network.name);
      console.log("   Or configure manually via endpoint owner");
    }
    throw error;
  }

  console.log("\n✅ OAppProxyOFT configured successfully!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
