/**
 * Test USDC.k payment flow: Bridge lock → receive USDC.k → x402 payment.
 * 
 * Flow:
 * 1. Lock USDC on Base Sepolia → relayer mints USDC.k on Story Aeneid
 * 2. Test x402 (EIP-3009) transferWithAuthorization with USDC.k
 * 
 * Usage:
 *   # Step 1: Lock USDC on Base Sepolia
 *   npx hardhat run scripts/test-bridge-lock.js --network baseSepolia
 *   
 *   # Step 2: Wait for relayer to fulfill (~15s), then test x402
 *   npx hardhat run scripts/test-usdck-payment.js --network storyAeneid
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const bridgeDeploy = JSON.parse(
    fs.readFileSync("deployments/bridge-story-aeneid-latest.json", "utf8")
  );
  const adapterDeploy = JSON.parse(
    fs.readFileSync("deployments/bridge-evvm-adapter-latest.json", "utf8")
  );

  const bridgeUsdcAddress = bridgeDeploy.bridgeUsdc;
  const adapterAddress = adapterDeploy.address;

  const BridgeUSDC = await hre.ethers.getContractAt("BridgeUSDC", bridgeUsdcAddress);
  const Adapter = await hre.ethers.getContractAt("EVVMPaymentAdapter", adapterAddress);

  console.log("🧪 USDC.k Payment Test\n");
  console.log("Signer:", signer.address);
  console.log("BridgeUSDC (USDC.k):", bridgeUsdcAddress);
  console.log("EVVM Adapter:", adapterAddress);

  const balanceBefore = await BridgeUSDC.balanceOf(signer.address);
  console.log("USDC.k balance:", hre.ethers.formatUnits(balanceBefore, 6), "USDC.k\n");

  if (balanceBefore === 0n) {
    console.log("⚠️  No USDC.k balance. Lock USDC on Base Sepolia first:");
    console.log("   npx hardhat run scripts/test-bridge-lock.js --network baseSepolia");
    console.log("   Then wait ~15s for relayer to fulfill.\n");
    process.exit(1);
  }

  const amount = hre.ethers.parseUnits("0.001", 6);
  if (amount > balanceBefore) {
    console.log("❌ Balance too low. Need at least 0.001 USDC.k");
    process.exit(1);
  }

  // Test 1: Direct transfer
  console.log("📤 Test 1: Direct transfer to adapter...");
  const tx1 = await BridgeUSDC.transfer(adapterAddress, amount);
  await tx1.wait();
  console.log("   ✅ Transfer successful:", tx1.hash);

  const balanceAfter = await BridgeUSDC.balanceOf(signer.address);
  const adapterBalance = await BridgeUSDC.balanceOf(adapterAddress);
  console.log("   Signer balance:", hre.ethers.formatUnits(balanceAfter, 6), "USDC.k");
  console.log("   Adapter balance:", hre.ethers.formatUnits(adapterBalance, 6), "USDC.k\n");

  // Test 2: x402 (EIP-3009) transferWithAuthorization
  if (balanceAfter < amount) {
    console.log("⚠️  Skipping x402 test - insufficient balance after transfer");
    process.exit(0);
  }

  console.log("📤 Test 2: x402 (EIP-3009) transferWithAuthorization...");
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = hre.ethers.hexlify(hre.ethers.randomBytes(32));

  const chainId = Number(network.chainId);
  const domain = {
    name: "USDC Krump", // Updated for USDC.k
    version: "1",
    chainId,
    verifyingContract: bridgeUsdcAddress,
  };
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };
  const value = {
    from: signer.address,
    to: adapterAddress,
    amount,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await signer.signTypedData(domain, types, value);
  const sig = hre.ethers.Signature.from(signature);

  const tx2 = await BridgeUSDC.transferWithAuthorization(
    signer.address,
    adapterAddress,
    amount,
    validAfter,
    validBefore,
    nonce,
    sig.v,
    sig.r,
    sig.s
  );
  await tx2.wait();
  console.log("   ✅ x402 transfer successful:", tx2.hash);

  const finalBalance = await BridgeUSDC.balanceOf(signer.address);
  const finalAdapterBalance = await BridgeUSDC.balanceOf(adapterAddress);
  console.log("   Final signer balance:", hre.ethers.formatUnits(finalBalance, 6), "USDC.k");
  console.log("   Final adapter balance:", hre.ethers.formatUnits(finalAdapterBalance, 6), "USDC.k");

  console.log("\n✅ USDC.k payment tests passed!");
  console.log("   - Direct transfer ✅");
  console.log("   - x402 (EIP-3009) transferWithAuthorization ✅");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
