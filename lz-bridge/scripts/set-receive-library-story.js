/**
 * Set receive library for OApp on Story Aeneid so commitVerification -> endpoint.verify()
 * does not revert with LZ_DefaultReceiveLibUnavailable (0x78e84d06).
 *
 * Run: npx hardhat run scripts/set-receive-library-story.js --network storyAeneid
 *
 * Requires: signer must be the OApp (OAppProxyOFT) or the endpoint delegate for that OApp.
 */
const hre = require("hardhat");
const fs = require("fs");

const BASE_SEPOLIA_EID = 40245;

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid: npx hardhat run scripts/set-receive-library-story.js --network storyAeneid");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const story = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const oappDeploy = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8"));

  const oapp = hre.ethers.getAddress(oappDeploy.oappProxyOft);
  const endpointAddr = story.endpointV2;
  const receiveUln = story.receiveUln302;

  const endpoint = await hre.ethers.getContractAt(
    ["function getReceiveLibrary(address _receiver, uint32 _srcEid) view returns (address lib, bool isDefault)", "function setReceiveLibrary(address _oapp, uint32 _eid, address _newLib, uint256 _gracePeriod) external", "function delegates(address) view returns (address)"],
    endpointAddr
  );

  let currentLib;
  try {
    [currentLib] = await endpoint.getReceiveLibrary(oapp, BASE_SEPOLIA_EID);
  } catch (e) {
    // getReceiveLibrary reverts with LZ_DefaultReceiveLibUnavailable when nothing is set
    currentLib = null;
  }
  if (currentLib && currentLib !== hre.ethers.ZeroAddress) {
    console.log("✅ Receive library already set for (OApp, 40245):", currentLib);
    if (currentLib.toLowerCase() === receiveUln.toLowerCase()) {
      console.log("   Matches ReceiveUln302. No change needed.");
    } else {
      console.log("   (ReceiveUln302 is", receiveUln + "; consider updating if intended lib is ReceiveUln302)");
    }
    return;
  }

  console.log("Setting receive library for (OApp, Base Sepolia) to ReceiveUln302...");
  console.log("   OApp:", oapp);
  console.log("   ReceiveUln302:", receiveUln);
  console.log("   Signer:", signer.address);

  const delegate = await endpoint.delegates(oapp);
  if (delegate !== ethers.ZeroAddress) console.log("   Endpoint delegate for OApp:", delegate);
  if (signer.address.toLowerCase() !== oapp.toLowerCase() && (delegate === hre.ethers.ZeroAddress || delegate.toLowerCase() !== signer.address.toLowerCase())) {
    console.error("❌ Signer is not the OApp and not the endpoint delegate. Set delegate first or run as OApp.");
    process.exit(1);
  }

  try {
    const tx = await endpoint.setReceiveLibrary(oapp, BASE_SEPOLIA_EID, receiveUln, 0);
    await tx.wait();
    console.log("✅ Receive library set. Tx:", tx.hash);
  } catch (e) {
    if (e.message && e.message.includes("LZ_Unauthorized")) {
      console.error("❌ LZ_Unauthorized: signer must be the OApp or the endpoint delegate for this OApp.");
    } else {
      console.error("❌ Failed:", e.message);
      if (e.data) console.error("   Data:", e.data);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
