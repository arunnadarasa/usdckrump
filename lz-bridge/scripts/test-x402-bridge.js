const hre = require("hardhat");
const fs = require("fs");

/**
 * Test x402 (EIP-3009) with BridgeUSDC and the Bridge EVVM adapter.
 * Same flow as test-x402-payment.js but uses BridgeUSDC and bridge-evvm-adapter.
 */

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 1315n) {
    console.error("❌ Run on Story Aeneid: --network storyAeneid");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const adapterDeployment = JSON.parse(
    fs.readFileSync("deployments/bridge-evvm-adapter-latest.json", "utf8")
  );
  const usdcAddress = adapterDeployment.constructorArgs.usdcDance;
  const adapterAddress = adapterDeployment.address;

  const BridgeUSDC = await hre.ethers.getContractAt("BridgeUSDC", usdcAddress);
  const Adapter = await hre.ethers.getContractAt("EVVMPaymentAdapter", adapterAddress);

  const balanceBefore = await BridgeUSDC.balanceOf(signer.address);
  const adapterBalanceBefore = await BridgeUSDC.balanceOf(adapterAddress);
  console.log("🧪 x402 Payment Test (BridgeUSDC → Bridge EVVM Adapter)\n");
  console.log("Signer:", signer.address);
  console.log("Adapter (bridge):", adapterAddress);
  console.log("BridgeUSDC (signer):", hre.ethers.formatUnits(balanceBefore, 6));
  console.log("BridgeUSDC (adapter):", hre.ethers.formatUnits(adapterBalanceBefore, 6));

  if (balanceBefore === 0n) {
    console.log("\n❌ No BridgeUSDC. Lock on Base Sepolia and run relayer to get USDC.d on Story Aeneid.");
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

  console.log("\n📤 Executing transferWithAuthorization (x402) to bridge adapter...");
  const tx = await BridgeUSDC.transferWithAuthorization(
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

  const adapterBalanceAfter = await BridgeUSDC.balanceOf(adapterAddress);
  const expected = adapterBalanceBefore + amount;
  if (adapterBalanceAfter !== expected) {
    console.log("\n❌ Adapter balance mismatch. Expected:", hre.ethers.formatUnits(expected, 6), "Got:", hre.ethers.formatUnits(adapterBalanceAfter, 6));
    process.exit(1);
  }
  console.log("   Adapter BridgeUSDC balance after:", hre.ethers.formatUnits(adapterBalanceAfter, 6));
  console.log("\n✅ x402 with BridgeUSDC verified: EIP-3009 transfer to bridge adapter succeeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
