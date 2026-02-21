const hre = require("hardhat");

/**
 * Deposit USDC.k into EVVM so the payer has internal balance for Core.pay().
 * EVVM v3 Core.pay() only moves internal ledger balances; it does not pull tokens.
 * Run with the PAYER's private key (PRIVATE_KEY). Optional: DEPOSIT_AMOUNT (6 decimals, default 1000000 = 1 USDC.k).
 *
 * Usage:
 *   PRIVATE_KEY=0x<payer_key> DEPOSIT_AMOUNT=1000000 npm run evvm:deposit-usdck -- --network storyAeneid
 */
const USDC_KRAMP = "0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5";
const EVVM_TREASURY = "0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc";

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 1315) {
    console.error("❌ Run on Story Aeneid (chainId 1315): --network storyAeneid");
    process.exit(1);
  }

  const amount = process.env.DEPOSIT_AMOUNT
    ? BigInt(process.env.DEPOSIT_AMOUNT)
    : 1_000_000n; // 1 USDC.k (6 decimals)

  const [signer] = await hre.ethers.getSigners();
  const payer = signer.address;

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
    ],
    USDC_KRAMP
  );
  const treasury = await hre.ethers.getContractAt(
    ["function deposit(address token, uint256 amount) external"],
    EVVM_TREASURY
  );

  const balance = await token.balanceOf(payer);
  if (balance < amount) {
    console.error("❌ Insufficient USDC.k. Have:", hre.ethers.formatUnits(balance, 6), "need:", hre.ethers.formatUnits(amount, 6));
    process.exit(1);
  }

  const allowance = await token.allowance(payer, EVVM_TREASURY);
  if (allowance < amount) {
    console.log("Approving Treasury for", hre.ethers.formatUnits(amount, 6), "USDC.k...");
    const approveTx = await token.approve(EVVM_TREASURY, amount);
    await approveTx.wait();
    console.log("   Tx:", approveTx.hash);
  } else {
    console.log("Treasury already approved for at least", hre.ethers.formatUnits(amount, 6), "USDC.k.");
  }

  console.log("Depositing", hre.ethers.formatUnits(amount, 6), "USDC.k into EVVM Treasury...");
  const depositTx = await treasury.deposit(USDC_KRAMP, amount);
  await depositTx.wait();
  console.log("   Tx:", depositTx.hash);
  console.log("✅ Payer", payer, "now has", hre.ethers.formatUnits(amount, 6), "USDC.k internal balance in EVVM. You can run the x402 native two-agent script.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
