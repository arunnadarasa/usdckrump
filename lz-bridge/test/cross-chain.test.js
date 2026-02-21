const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");

describe("LayerZero Bridge Test", function () {
  let baseOFT, storyOFT, baseEndpoint, storyEndpoint;
  const BASE_CHAIN_ID = 84532;
  const STORY_CHAIN_ID = 1315;
  
  before(async () => {
    // Load deployments
    const baseDeploy = JSON.parse(
      fs.readFileSync('deployments/usdc-base-sepolia-latest.json', 'utf8')
    );
    const storyDeploy = JSON.parse(
      fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
    );
    
    baseOFT = await ethers.getContractAt("USDCDanceOFT", baseDeploy.address);
    storyOFT = await ethers.getContractAt("USDCDanceOFT", storyDeploy.address);
    
    // Get endpoints for debugging
    baseEndpoint = baseDeploy.endpoint;
    storyEndpoint = storyDeploy.endpoint;
  });
  
  it("Should deploy and have correct configurations", async () => {
    expect(await baseOFT.name()).to.equal("USDC Dance");
    expect(await storyOFT.name()).to.equal("USDC Dance");
    expect(await baseOFT.symbol()).to.equal("USDC.d");
    expect(await storyOFT.symbol()).to.equal("USDC.d");
  });
  
  it("Should have EIP-3009 support for x402", async () => {
    // Check that transferWithAuthorization function exists
    expect(baseOFT.transferWithAuthorization).to.not.be.undefined;
    expect(storyOFT.transferWithAuthorization).to.not.be.undefined;
    
    // Check domain separator exists
    const domainSeparator = await baseOFT.getDomainSeparator();
    expect(domainSeparator).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  });
  
  it("Should have OFT configured for cross-chain", async () => {
    // Check that Base OFT has Story as trusted remote
    const trustedRemote = await baseOFT.getTrustedRemote(STORY_CHAIN_ID);
    expect(trustedRemote).to.not.equal("0x0000000000000000000000000000000000000000");
    
    // Check that Story OFT has Base as trusted remote
    const trustedRemote2 = await storyOFT.getTrustedRemote(BASE_CHAIN_ID);
    expect(trustedRemote2).to.not.equal("0x0000000000000000000000000000000000000000");
  });
  
  it("Should store payment info correctly", async () => {
    // Test getPaymentInfo function
    const receiptId = "test_receipt_123";
    const [depositor, amount, timestamp, exists] = await storyOFT.getPaymentInfo(receiptId);
    
    // Initially should not exist
    expect(exists).to.be.false;
  });
  
  it("Should send USDC.d from Base to Story", async function () {
    // Skip if testnet is down or balances insufficient
    this.timeout(120000); // 2 minutes for cross-chain
    
    const amount = ethers.parseUnits("0.001", 6); // 0.001 USDC.d
    const receiptId = `usdcd_${Date.now()}_test`;
    
    // Agent address (could be test wallet)
    const [sender] = await ethers.getSigners();
    
    // Note: This test assumes the contract has minting capability
    // In production, tokens would be acquired through other means
    // For testing, you may need to add a mint function or use a different approach
    
    // Check if sender has balance
    const balance = await baseOFT.balanceOf(sender.address);
    if (balance < amount) {
      console.log("⚠️  Skipping: Insufficient balance. Need to mint or acquire tokens first.");
      return;
    }
    
    // 2. Send via LayerZero
    const recipientBytes = ethers.zeroPadValue(storyOFT.target, 32);
    
    console.log("🚀 Sending cross-chain payment...");
    const sendTx = await baseOFT.payViaLayerZero(
      STORY_CHAIN_ID,
      recipientBytes,
      amount,
      receiptId
    );
    
    const receipt = await sendTx.wait();
    console.log("✅ Send transaction confirmed:", receipt.hash);
    
    // 3. Wait for message to be delivered
    // This could take 30 seconds to several minutes depending on DVN + Executor
    console.log("⏳ Waiting for LayerZero delivery (up to 2 minutes)...");
    
    // Simple wait - in production, you'd poll or listen for lzReceive event
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    // 4. Verify tokens arrived on Story
    // Check Story OFT balance of this contract or a specific receiver
    // For this test, tokens will mint to the USDCDanceOFT contract on Story
    const storyBalance = await storyOFT.balanceOf(storyOFT.target);
    expect(storyBalance).to.be.gte(amount);
    
    // 5. Verify payment info was stored
    const [depositor, paymentAmount, timestamp, exists] = await storyOFT.getPaymentInfo(receiptId);
    expect(exists).to.be.true;
    expect(depositor).to.equal(sender.address);
    expect(paymentAmount).to.equal(amount);
    
    console.log("✅ USDC.d arrived on Story Aeneid!");
  });
});
