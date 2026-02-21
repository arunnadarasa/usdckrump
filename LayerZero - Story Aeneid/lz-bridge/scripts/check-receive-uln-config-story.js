/**
 * Check ReceiveUln302 ULN config on Story Aeneid for OApp + srcEid 40245.
 * Run: npx hardhat run scripts/check-receive-uln-config-story.js --network storyAeneid
 */
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");

const STORY_OAPP = "0xD4F9d22A3ca73Dfe117C641A1F492Bf49B0B2E86";
const BASE_EID = 40245;

async function main() {
  const story = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const receiveUln = await hre.ethers.getContractAt(
    "ReceiveUln302",
    story.receiveUln302
  );
  const config = await receiveUln.getUlnConfig(STORY_OAPP, BASE_EID);
  console.log("ReceiveUln302:", story.receiveUln302);
  console.log("getUlnConfig(OApp, 40245):");
  console.log("  confirmations:", config.confirmations.toString());
  console.log("  requiredDVNCount:", config.requiredDVNCount);
  console.log("  requiredDVNs:", config.requiredDVNs);
  console.log("  optionalDVNCount:", config.optionalDVNCount);
  console.log("  optionalDVNThreshold:", config.optionalDVNThreshold);
  console.log("  optionalDVNs:", config.optionalDVNs || []);
  console.log("  VerifierDVN in requiredDVNs?", (config.requiredDVNs || []).some(a => a.toLowerCase() === (story.verifierDVN || "").toLowerCase()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
