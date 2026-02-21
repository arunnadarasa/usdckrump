const hre = require("hardhat");
const fs = require("fs");

/**
 * Test x402 (EIP-3009) payment flow: sign transferWithAuthorization and send USDC.d to the adapter.
 * This verifies the adapter can receive x402 payments. Full payViaEVVMWithX402 also requires EVVM signature.
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const adapterDeployment = JSON.parse(
    fs.readFileSync("deployments/storyAeneid-evvm-adapter-latest.json", "utf8")
  );
  const usdcAddress = adapterDeployment.constructorArgs.usdcDance;
  const adapterAddress = adapterDeployment.address;

  const USDC = await hre.ethers.getContractAt("USDCDanceOFT", usdcAddress);
  const Adapter = await hre.ethers.getContractAt("EVVMPaymentAdapter", adapterAddress);

  const balanceBefore = await USDC.balanceOf(signer.address);
  const adapterBalanceBefore = await USDC.balanceOf(adapterAddress);
  console.log("🧪 x402 Payment Test (EIP-3009 transfer to adapter)\n");
  console.log("Signer:", signer.address);
  console.log("Adapter:", adapterAddress);
  console.log("USDC.d balance (signer):", hre.ethers.formatUnits(balanceBefore, 6));
  console.log("USDC.d balance (adapter):", hre.ethers.formatUnits(adapterBalanceBefore, 6));

  if (balanceBefore === 0n) {
    console.log("\n❌ No USDC.d to send. Mint first: npm run mint:tokens -- --network storyAeneid");
    process.exit(1);
  }

  const amount = hre.ethers.parseUnits("0.001", 6);
  if (amount > balanceBefore) {
    console.log("\n❌ Balance too low for 0.001 USDC.d");
    process.exit(1);
  }

  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = hre.ethers.hexlify(hre.ethers.randomBytes(32));

  const chainId = Number(network.chainId);
  const domain = {
    name: "USDC Dance",
    version: "1",
    chainId,
    verifyingContract: usdcAddress,
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

  console.log("\n📤 Executing transferWithAuthorization (x402) to adapter...");
  const tx = await USDC.transferWithAuthorization(
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
  await tx.wait();
  console.log("   Tx hash:", tx.hash);

  const adapterBalanceAfter = await USDC.balanceOf(adapterAddress);
  const expected = adapterBalanceBefore + amount;
  if (adapterBalanceAfter !== expected) {
    console.log("\n❌ Adapter balance mismatch. Expected:", hre.ethers.formatUnits(expected, 6), "Got:", hre.ethers.formatUnits(adapterBalanceAfter, 6));
    process.exit(1);
  }
  console.log("   Adapter USDC.d balance after:", hre.ethers.formatUnits(adapterBalanceAfter, 6));
  console.log("\n✅ x402 payment flow verified: EIP-3009 transfer to adapter succeeded.");
  console.log("   Full payViaEVVMWithX402 (incl. EVVM Core.pay) requires EVVM signature.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
