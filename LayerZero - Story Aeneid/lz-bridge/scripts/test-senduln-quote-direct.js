/**
 * Test quote() directly on SendUln302 to isolate the 0x6592671c error
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error("❌ Run on Base Sepolia: --network baseSepolia");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("🧪 Testing SendUln302.quote() Directly");
  console.log("=".repeat(60));
  console.log("Deployer:", signer.address, "\n");

  // Load deployments
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const proxyOftDeployment = JSON.parse(fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8"));

  console.log("📋 Configuration:");
  console.log("   SendUln302:", ownEndpoint.sendUln302);
  console.log("   OAppProxyOFT:", proxyOftDeployment.oappProxyOft);
  console.log("   Story Aeneid EID: 1315\n");

  const sendUln = await hre.ethers.getContractAt("SendUln302", ownEndpoint.sendUln302);

  // Test quote() directly on SendUln302
  // SendUln302.quote() signature: quote(uint32 _dstEid, address _sender, uint256 _msgSize, bool _payInLzToken, bytes calldata _options)
  const dstEid = 1315;
  const sender = proxyOftDeployment.oappProxyOft;
  const msgSize = 100; // Approximate message size for OFT
  const payInLzToken = false;

  const testCases = [
    { name: "Empty options (0x)", options: "0x" },
    { name: "Legacy Type 1", options: hre.ethers.solidityPacked(["uint16", "uint256"], [1, 0]) },
    { name: "Type 3 minimal", options: "0x00030100110100000000000000000000000000000000" },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log("   Options:", testCase.options);
    console.log("   Length:", testCase.options.length, "bytes");

    try {
      const [nativeFee, lzTokenFee] = await sendUln.quote(
        dstEid,
        sender,
        msgSize,
        payInLzToken,
        testCase.options
      );
      console.log("   ✅ quote() SUCCESS!");
      console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), "ETH");
      console.log("   LZ Token Fee:", hre.ethers.formatEther(lzTokenFee), "LZ");
      console.log("\n   🎉 This option format works!");
      return;
    } catch (error) {
      const errorSig = error.data ? error.data.slice(0, 10) : "unknown";
      console.log("   ❌ quote() failed");
      console.log("   Error:", error.message);
      console.log("   Error signature:", errorSig);
      if (error.data && error.data.length > 10) {
        const cursor = hre.ethers.dataSlice(error.data, 4);
        console.log("   Cursor:", cursor);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("❌ All option formats failed on SendUln302.quote()");
  console.log("=".repeat(60));
  console.log("\n💡 This confirms the issue is in SendUln302 itself,");
  console.log("   not in how OFTAdapter calls it.");
  console.log("\n🔧 Next steps:");
  console.log("   1. Verify SendUln302 bytecode matches LayerZero V2 source");
  console.log("   2. Check if SendUln302 needs to be redeployed");
  console.log("   3. Consider using official LayerZero SendUln302 if available");
}

main().catch((e) => {
  console.error("❌ Script failed:", e.message);
  if (e.data) console.error("   Error data:", e.data);
  process.exit(1);
});
