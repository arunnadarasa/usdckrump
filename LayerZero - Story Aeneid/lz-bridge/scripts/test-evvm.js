const hre = require("hardhat");
const fs = require("fs");

/**
 * Test EVVM payment adapter with x402 protocol
 * Requires:
 * - EVVMPaymentAdapter deployed on Story Aeneid
 * - USDC.d tokens on Story Aeneid
 * - Valid EVVM signature
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  
  if (network.chainId !== 1315n) {
    console.error("❌ This script must be run on Story Aeneid (Chain ID 1315)");
    console.log("   Current network:", network.name, "Chain ID:", network.chainId.toString());
    process.exit(1);
  }

  console.log("🧪 Testing EVVM Payment Adapter\n");
  console.log("=".repeat(60));

  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`IP Balance: ${hre.ethers.formatEther(balance)} IP\n`);

  // Load deployments
  const adapterDeployment = JSON.parse(
    fs.readFileSync('deployments/storyAeneid-evvm-adapter-latest.json', 'utf8')
  );
  const storyDeployment = JSON.parse(
    fs.readFileSync('deployments/usdc-story-aeneid-latest.json', 'utf8')
  );

  console.log("📋 Contract Addresses:");
  console.log(`   EVVMPaymentAdapter: ${adapterDeployment.address}`);
  console.log(`   USDC.d Token: ${adapterDeployment.constructorArgs.usdcDance}`);
  console.log(`   EVVM Core: ${adapterDeployment.constructorArgs.evvmCore}`);
  console.log(`   EVVM ID: ${adapterDeployment.constructorArgs.evvmId}\n`);

  // Get contract instances
  const Adapter = await hre.ethers.getContractAt(
    "EVVMPaymentAdapter",
    adapterDeployment.address
  );

  const USDC = await hre.ethers.getContractAt(
    "USDCDanceOFT",
    adapterDeployment.constructorArgs.usdcDance
  );

  // Check USDC.d balance
  const tokenBalance = await USDC.balanceOf(signer.address);
  console.log(`💰 USDC.d Balance: ${hre.ethers.formatUnits(tokenBalance, 6)} USDC.d\n`);

  // Get adapter config (immutable vars)
  try {
    const adapterUsdc = await Adapter.usdcDance();
    const adapterCore = await Adapter.evvmCore();
    const adapterEvvmId = await Adapter.evvmId();
    console.log("📋 Adapter config (from contract):");
    console.log(`   USDC.d: ${adapterUsdc}`);
    console.log(`   EVVM Core: ${adapterCore}`);
    console.log(`   EVVM ID: ${adapterEvvmId.toString()}\n`);
  } catch (error) {
    console.log("⚠️  Could not fetch adapter config:", error.message);
  }

  // Get EVVM payment info for a receipt (returns tuple: from, to, amount, timestamp, exists)
  try {
    const paymentInfo = await Adapter.getEVVMPaymentInfo("test-receipt");
    const [from, to, amount, timestamp, exists] = paymentInfo;
    if (exists) {
      console.log("📋 Sample EVVM Payment Info (test-receipt):");
      console.log(`   from: ${from}, to: ${to}, amount: ${amount}\n`);
    }
  } catch (error) {
    console.log("⚠️  getEVVMPaymentInfo:", error.message);
  }

  // Test domain separator (for EIP-712 signing)
  try {
    const domainSeparator = await USDC.getDomainSeparator();
    console.log("🔐 Domain Separator:", domainSeparator);
    console.log("   (Use this for EIP-712 signature generation)\n");
  } catch (error) {
    console.log("⚠️  Could not fetch domain separator:", error.message);
  }

  console.log("📝 EVVM Payment Flow:");
  console.log("   1. User signs EIP-3009 authorization (transferWithAuthorization)");
  console.log("   2. Adapter receives authorization and executes transfer");
  console.log("   3. Adapter calls EVVM Core.pay() with transferred tokens");
  console.log("   4. EVVM processes payment on EVVM ID 1140 (KrumpChain)\n");

  console.log("💡 To test full flow:");
  console.log("   1. Generate EIP-712 signature for transferWithAuthorization");
  console.log("   2. Generate EVVM signature for Core.pay()");
  console.log("   3. Call adapter.payViaEVVMWithX402() with both signatures\n");

  console.log("📚 Example parameters needed:");
  console.log("   - from: Token sender address");
  console.log("   - to: Token recipient (adapter or EVVM Core)");
  console.log("   - amount: Amount in USDC.d (6 decimals)");
  console.log("   - validAfter: Timestamp when authorization becomes valid");
  console.log("   - validBefore: Timestamp when authorization expires");
  console.log("   - nonce: Unique nonce for this authorization");
  console.log("   - v, r, s: EIP-712 signature components");
  console.log("   - receiptId: EVVM receipt ID");
  console.log("   - evvmNonce: EVVM transaction nonce");
  console.log("   - isAsyncExec: Whether async execution");
  console.log("   - evvmSignature: EVVM signature\n");

  console.log("=".repeat(60));
  console.log("\n✅ Adapter is ready for testing!");
  console.log("   See OpenClaw skill for complete integration example.\n");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
