/**
 * Deploy VerifierDVN on Story Aeneid and optionally configure ReceiveUln302.
 * Run: npx hardhat run scripts/deploy-verifier-dvn-story.js --network storyAeneid
 *
 * After deploy:
 * 1. Add "verifierDVN": "<address>" to deployments/story-aeneid-latest.json
 * 2. Configure ReceiveUln302 so VerifierDVN is the required DVN for srcEid 40245 (Base Sepolia).
 *    If this script is run by ReceiveUln302 owner, it will call setDefaultUlnConfigs.
 */
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");

const BASE_SEPOLIA_EID = 40245;

async function main() {
  const storyPath = "deployments/story-aeneid-latest.json";
  if (!fs.existsSync(storyPath)) {
    console.error("❌ Missing deployments/story-aeneid-latest.json");
    process.exit(1);
  }
  const story = JSON.parse(fs.readFileSync(storyPath, "utf8"));
  const receiveUln302 = story.receiveUln302;
  if (!receiveUln302) {
    console.error("❌ story-aeneid-latest.json missing receiveUln302");
    process.exit(1);
  }

  console.log("Deploying VerifierDVN on Story Aeneid");
  console.log("   ReceiveUln302:", receiveUln302);

  const VerifierDVN = await hre.ethers.getContractFactory("VerifierDVN");
  const verifier = await VerifierDVN.deploy(receiveUln302);
  await verifier.waitForDeployment();
  const address = await verifier.getAddress();
  console.log("   ✅ VerifierDVN deployed:", address);

  story.verifierDVN = address;
  fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
  console.log("   Updated story-aeneid-latest.json with verifierDVN");

  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", receiveUln302);
  const owner = await receiveUln.owner();
  const [deployer] = await hre.ethers.getSigners();
  if (owner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("\n   Configuring ReceiveUln302 default ULN for srcEid 40245 (Base Sepolia)...");
    const config = {
      confirmations: 0,
      requiredDVNCount: 1,
      optionalDVNCount: 0,
      optionalDVNThreshold: 0,
      requiredDVNs: [address],
      optionalDVNs: [],
    };
    const param = { eid: BASE_SEPOLIA_EID, config };
    const tx = await receiveUln.setDefaultUlnConfigs([param]);
    await tx.wait();
    console.log("   ✅ ReceiveUln302 setDefaultUlnConfigs(40245, VerifierDVN) tx:", tx.hash);
  } else {
    console.log("\n   ⚠️  ReceiveUln302 owner is", owner, "- not deployer. Configure manually:");
    console.log("   On Story Aeneid, call ReceiveUln302.setDefaultUlnConfigs([{ eid: 40245, config: { confirmations: 0, requiredDVNCount: 1, requiredDVNs: ['" + address + "'], optionalDVNCount: 0, optionalDVNThreshold: 0, optionalDVNs: [] } }])");
  }

  console.log("\n✅ Done. Run verifier worker: LZ_VERIFIER_KEY=<key> node scripts/lz-verifier-worker-oapp-proxy.js");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
