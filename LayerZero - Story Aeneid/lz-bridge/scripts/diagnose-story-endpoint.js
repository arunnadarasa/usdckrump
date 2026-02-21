/**
 * Diagnose Story Aeneid endpoint configuration for receiving from Base Sepolia
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const storyInfra = JSON.parse(fs.readFileSync("deployments/story-aeneid-latest.json", "utf8"));
  const storyOft = JSON.parse(fs.readFileSync("deployments/usdckrump-story-aeneid-latest.json", "utf8"));
  const baseOft = JSON.parse(fs.readFileSync("deployments/usdckrump-base-sepolia-latest.json", "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const endpoint = await hre.ethers.getContractAt("EndpointV2", storyInfra.endpointV2);
  const sendUln = await hre.ethers.getContractAt("SendUln302", storyInfra.sendUln302);
  const receiveUln = await hre.ethers.getContractAt("ReceiveUln302", storyInfra.receiveUln302);

  console.log("🔍 Diagnosing Story Aeneid Endpoint Configuration");
  console.log("=".repeat(60));
  console.log("Endpoint:", storyInfra.endpointV2);
  console.log("SendUln302:", storyInfra.sendUln302);
  console.log("ReceiveUln302:", storyInfra.receiveUln302);
  console.log("USDCKrumpOFT:", storyOft.address);
  console.log("Base Sepolia EID: 84532\n");

  // 1. Check EID support
  console.log("1. EID Support (Base Sepolia = 84532):");
  const sendSupports = await sendUln.isSupportedEid(84532);
  const receiveSupports = await receiveUln.isSupportedEid(84532);
  console.log("   SendUln302 supports EID 84532:", sendSupports ? "✅" : "❌");
  console.log("   ReceiveUln302 supports EID 84532:", receiveSupports ? "✅" : "❌\n");

  // 2. Check library registration
  console.log("2. Library Registration:");
  const sendRegistered = await endpoint.isRegisteredLibrary(storyInfra.sendUln302);
  const receiveRegistered = await endpoint.isRegisteredLibrary(storyInfra.receiveUln302);
  console.log("   SendUln302 registered:", sendRegistered ? "✅" : "❌");
  console.log("   ReceiveUln302 registered:", receiveRegistered ? "✅" : "❌\n");

  // 3. Check default libraries for Base Sepolia
  console.log("3. Default Libraries (EID 84532):");
  try {
    const defaultSend = await endpoint.defaultSendLibrary(84532);
    const defaultReceive = await endpoint.defaultReceiveLibrary(84532);
    console.log("   Default send library:", defaultSend);
    console.log("   Expected:", storyInfra.sendUln302);
    console.log("   Match:", defaultSend.toLowerCase() === storyInfra.sendUln302.toLowerCase() ? "✅" : "❌");
    console.log("   Default receive library:", defaultReceive);
    console.log("   Expected:", storyInfra.receiveUln302);
    console.log("   Match:", defaultReceive.toLowerCase() === storyInfra.receiveUln302.toLowerCase() ? "✅" : "❌\n");
  } catch (e) {
    console.log("   ❌ Error:", e.message, "\n");
  }

  // 4. Check OApp-specific libraries
  console.log("4. OApp Libraries (USDCKrumpOFT → Base Sepolia):");
  try {
    const [sendLib, isDefaultSend] = await endpoint.getSendLibrary(storyOft.address, 84532);
    const [receiveLib, isDefaultReceive] = await endpoint.getReceiveLibrary(storyOft.address, 84532);
    console.log("   Send library:", sendLib);
    console.log("   Is default:", isDefaultSend);
    console.log("   Receive library:", receiveLib);
    console.log("   Is default:", isDefaultReceive);
    console.log("   Expected receive:", storyInfra.receiveUln302);
    console.log("   Receive match:", receiveLib.toLowerCase() === storyInfra.receiveUln302.toLowerCase() ? "✅" : "❌\n");
  } catch (e) {
    console.log("   ❌ Error:", e.message, "\n");
  }

  // 5. Check peers
  console.log("5. Peer Configuration:");
  try {
    const oft = await hre.ethers.getContractAt("USDCKrumpOFT", storyOft.address);
    const peer = await oft.peers(84532);
    const expectedPeer = hre.ethers.zeroPadValue(baseOft.address, 32);
    console.log("   Story → Base peer:", peer);
    console.log("   Expected:", expectedPeer);
    console.log("   Match:", peer.toLowerCase() === expectedPeer.toLowerCase() ? "✅" : "❌\n");
  } catch (e) {
    console.log("   ❌ Error:", e.message, "\n");
  }

  // 6. Check endpoint owner
  console.log("6. Endpoint Ownership:");
  const owner = await endpoint.owner();
  console.log("   Owner:", owner);
  console.log("   Deployer:", signer.address);
  console.log("   Match:", owner.toLowerCase() === signer.address.toLowerCase() ? "✅" : "❌\n");

  // 7. Check if endpoint supports Base Sepolia EID
  try {
    const isSupported = await endpoint.isSupportedEid(84532);
    console.log("7. Endpoint supports EID 84532:", isSupported ? "✅" : "❌");
  } catch (e) {
    console.log("7. Error checking endpoint support:", e.message);
  }
}

main().catch(console.error);
