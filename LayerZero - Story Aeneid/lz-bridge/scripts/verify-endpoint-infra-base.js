const hre = require("hardhat");
const fs = require("fs");

/**
 * Verify EndpointV2 infrastructure on Base Sepolia (BaseScan).
 * Requires ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env.
 */
async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 84532) {
    console.error("❌ Run on Base Sepolia: npx hardhat run scripts/verify-endpoint-infra-base.js --network baseSepolia");
    process.exit(1);
  }

  if (!process.env.ETHERSCAN_API_KEY && !process.env.BASESCAN_API_KEY) {
    console.error("❌ Set ETHERSCAN_API_KEY or BASESCAN_API_KEY in .env (Etherscan API V2 key).");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8")
  );

  console.log("🔍 Verifying EndpointV2 Infrastructure on BaseScan (Base Sepolia)...\n");

  // 1. Verify EndpointV2
  // Constructor: (uint32 _eid, address _owner)
  console.log("1/3 Verifying EndpointV2...");
  console.log("   Address:", deployment.endpointV2);
  const endpointArgs = [84532, deployment.deployer];
  try {
    await hre.run("verify:verify", {
      address: deployment.endpointV2,
      constructorArguments: endpointArgs,
      network: "baseSepolia",
      contract: "contracts/layerzero-infra/protocol/EndpointV2.sol:EndpointV2",
    });
    console.log("   ✅ EndpointV2 verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.endpointV2 + "#code\n");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("   ⚠️  EndpointV2 already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.endpointV2 + "#code\n");
    } else {
      console.error("   ❌ EndpointV2 verification failed:", err.message);
      const encoded = new hre.ethers.AbiCoder().encode(["uint32", "address"], endpointArgs);
      console.log("   Manual verification - Constructor args (ABI-encoded):", encoded.slice(2));
    }
  }

  // 2. Verify SendUln302
  // Constructor: (address _endpoint, uint256 _treasuryGasLimit, uint256 _treasuryGasForFeeCap)
  console.log("2/3 Verifying SendUln302...");
  console.log("   Address:", deployment.sendUln302);
  const sendUlnArgs = [deployment.endpointV2, 50000, "1000000000000000000"]; // 1 ETH
  try {
    await hre.run("verify:verify", {
      address: deployment.sendUln302,
      constructorArguments: sendUlnArgs,
      network: "baseSepolia",
      contract: "contracts/layerzero-infra/messagelib/uln/uln302/SendUln302.sol:SendUln302",
    });
    console.log("   ✅ SendUln302 verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.sendUln302 + "#code\n");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("   ⚠️  SendUln302 already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.sendUln302 + "#code\n");
    } else {
      console.error("   ❌ SendUln302 verification failed:", err.message);
      const encoded = new hre.ethers.AbiCoder().encode(["address", "uint256", "uint256"], sendUlnArgs);
      console.log("   Manual verification - Constructor args (ABI-encoded):", encoded.slice(2));
    }
  }

  // 3. Verify ReceiveUln302
  // Constructor: (address _endpoint)
  console.log("3/3 Verifying ReceiveUln302...");
  console.log("   Address:", deployment.receiveUln302);
  const receiveUlnArgs = [deployment.endpointV2];
  try {
    await hre.run("verify:verify", {
      address: deployment.receiveUln302,
      constructorArguments: receiveUlnArgs,
      network: "baseSepolia",
      contract: "contracts/layerzero-infra/messagelib/uln/uln302/ReceiveUln302.sol:ReceiveUln302",
    });
    console.log("   ✅ ReceiveUln302 verified!");
    console.log("   https://sepolia.basescan.org/address/" + deployment.receiveUln302 + "#code\n");
  } catch (err) {
    if (err.message && (err.message.includes("Already Verified") || err.message.includes("already verified"))) {
      console.log("   ⚠️  ReceiveUln302 already verified.");
      console.log("   https://sepolia.basescan.org/address/" + deployment.receiveUln302 + "#code\n");
    } else {
      console.error("   ❌ ReceiveUln302 verification failed:", err.message);
      const encoded = new hre.ethers.AbiCoder().encode(["address"], receiveUlnArgs);
      console.log("   Manual verification - Constructor args (ABI-encoded):", encoded.slice(2));
    }
  }

  console.log("✅ Infrastructure verification complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
