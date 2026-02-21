const hre = require("hardhat");
const fs = require("fs");

/**
 * Test cross-chain transfer from Base Sepolia to Story Aeneid
 * Requires:
 * - Contracts deployed and linked
 * - Sufficient USDC.d balance on Base Sepolia
 * - Sufficient ETH on Base Sepolia for gas
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 84532n) {
    console.error("❌ This script must be run on Base Sepolia (Chain ID 84532)");
    console.log("   Current network:", network.name, "Chain ID:", network.chainId.toString());
    process.exit(1);
  }

  console.log("🧪 Testing Cross-Chain Transfer: Base Sepolia → Story Aeneid\n");
  console.log("=".repeat(60));

  const [sender] = await hre.ethers.getSigners();
  console.log("Sender:", sender.address);
  
  const balance = await hre.ethers.provider.getBalance(sender.address);
  console.log(`ETH Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Load deployments
  const baseDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Contract Addresses:");
  console.log(`   Base Sepolia OFT: ${baseDeployment.address}`);
  console.log(`   Story Aeneid OFT: ${storyDeployment.address}\n`);

  // Get contract instance
  const BaseOFT = await hre.ethers.getContractAt(
    "USDCDanceOFT",
    baseDeployment.address
  );

  // Check token balance
  const tokenBalance = await BaseOFT.balanceOf(sender.address);
  console.log(`💰 USDC.d Balance: ${hre.ethers.formatUnits(tokenBalance, 6)} USDC.d\n`);

  if (tokenBalance === 0n) {
    console.log("⚠️  No USDC.d balance. You need to mint or receive tokens first.");
    console.log("   For testing, you can mint tokens using the owner functions.\n");
    return;
  }

  // Check peer configuration
  const peer = await BaseOFT.peers(1315); // Story Aeneid EID
  const expectedPeer = hre.ethers.zeroPadValue(storyDeployment.address, 32);
  
  if (peer !== expectedPeer) {
    console.error("❌ Peer not configured correctly!");
    console.log(`   Expected: ${expectedPeer}`);
    console.log(`   Got: ${peer}`);
    console.log("\n   Run: npm run link:oft\n");
    process.exit(1);
  }

  console.log("✅ Peer configuration verified\n");

  // Prepare transfer parameters
  const transferAmount = hre.ethers.parseUnits("0.001", 6); // 0.001 USDC.d for testing
  const recipient = sender.address; // Send to self for testing

  console.log("📤 Preparing Transfer:");
  console.log(`   Amount: ${hre.ethers.formatUnits(transferAmount, 6)} USDC.d`);
  console.log(`   Recipient: ${recipient}`);
  console.log(`   Destination Chain: Story Aeneid (EID 1315)\n`);

  // Build send parameters
  const sendParam = {
    dstEid: 1315, // Story Aeneid
    to: hre.ethers.zeroPadValue(recipient, 32), // Recipient address (32 bytes)
    amountLD: transferAmount,
    minAmountLD: transferAmount, // No slippage tolerance for testnet
    extraOptions: "0x", // No extra options
    composeMsg: "0x", // No composed message
    oftCmd: "0x" // No OFT command
  };

  // Estimate fees
  console.log("💸 Estimating Fees...\n");
  
  try {
    const [nativeFee, lzTokenFee] = await BaseOFT.quoteSend(
      sendParam,
      false // payInLzToken = false (pay in native token)
    );

    console.log(`   Native Fee: ${hre.ethers.formatEther(nativeFee)} ETH`);
    console.log(`   LZ Token Fee: ${hre.ethers.formatEther(lzTokenFee)} LZ\n`);

    // Check if sender has enough ETH for fees
    if (balance < nativeFee) {
      console.error("❌ Insufficient ETH for fees!");
      console.log(`   Required: ${hre.ethers.formatEther(nativeFee)} ETH`);
      console.log(`   Available: ${hre.ethers.formatEther(balance)} ETH\n`);
      process.exit(1);
    }

    // Check if sender has enough tokens
    if (tokenBalance < transferAmount) {
      console.error("❌ Insufficient USDC.d balance!");
      console.log(`   Required: ${hre.ethers.formatUnits(transferAmount, 6)} USDC.d`);
      console.log(`   Available: ${hre.ethers.formatUnits(tokenBalance, 6)} USDC.d\n`);
      process.exit(1);
    }

    // Confirm before sending
    console.log("⚠️  Ready to send cross-chain transfer!");
    console.log("   This will:");
    console.log("   1. Lock tokens on Base Sepolia");
    console.log("   2. Send message via LayerZero");
    console.log("   3. Mint tokens on Story Aeneid (after message delivery)\n");
    
    console.log("📝 To execute, uncomment the send transaction below:\n");
    console.log("   // const tx = await BaseOFT.send(sendParam, { nativeFee, lzTokenFee }, sender.address);");
    console.log("   // await tx.wait();");
    console.log("   // console.log('✅ Transfer sent! Tx:', tx.hash);\n");

    // Uncomment below to actually send:
    /*
    console.log("🚀 Sending transfer...\n");
    const tx = await BaseOFT.send(
      sendParam,
      { nativeFee, lzTokenFee },
      sender.address
    );
    
    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("   Waiting for confirmation...\n");
    
    const receipt = await tx.wait();
    console.log("✅ Transfer initiated!");
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
    
    console.log("📋 Next Steps:");
    console.log("   1. Wait for LayerZero message delivery (usually 1-2 minutes)");
    console.log("   2. Check Story Aeneid for minted tokens:");
    console.log(`      https://aeneid.storyscan.io/address/${storyDeployment.address}#readContract`);
    console.log(`      Check balanceOf(${recipient})\n`);
    */

  } catch (error) {
    console.error("❌ Error estimating fees:", error.message);
    console.error("   Full error:", error);
    
    if (error.message.includes("LZ_ULN_NotSet") || error.message.includes("LZ_DefaultSendLibUnavailable")) {
      console.log("\n💡 Send library not configured for Story Aeneid (EID 1315)");
      console.log("   Base Sepolia uses LayerZero's official endpoint.");
      console.log("   LayerZero's endpoint may not support custom chains like Story Aeneid.");
      console.log("   You may need to:");
      console.log("   1. Register Story Aeneid with LayerZero");
      console.log("   2. Or configure custom pathway through LayerZero dashboard");
      console.log("   3. Or use LayerZero's cross-chain configuration UI\n");
    } else if (error.message.includes("LZ_DefaultReceiveLibUnavailable")) {
      console.log("\n💡 Receive library not configured on Story Aeneid");
      console.log("   Need to configure receive library for Base Sepolia (EID 84532)\n");
    } else {
      console.log("\n💡 Check LayerZero V2 documentation for custom chain setup:");
      console.log("   https://docs.layerzero.network/v2/\n");
    }
    
    process.exit(1);
  }

  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
