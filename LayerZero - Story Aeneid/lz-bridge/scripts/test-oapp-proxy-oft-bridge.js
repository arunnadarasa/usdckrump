const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🧪 Testing OAppProxyOFT bridge with new contracts\n");

  const network = await hre.ethers.provider.getNetwork();
  const [signer] = await hre.ethers.getSigners();

  // Load deployment
  const deployment = JSON.parse(
    fs.readFileSync(`deployments/oapp-proxy-oft-${network.name}-latest.json`, "utf8")
  );

  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("OAppProxyOFT:", deployment.oappProxyOft);
  console.log("Wrapped Token:", deployment.wrappedToken);
  console.log("Signer:", signer.address);

  const proxyOft = await hre.ethers.getContractAt(
    "OAppProxyOFT",
    deployment.oappProxyOft
  );
  const token = await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    deployment.wrappedToken
  );

  // Get token name/symbol for display
  let tokenName = "USDC";
  try {
    tokenName = await token.symbol();
  } catch {}

  // Check balances
  const tokenBalance = await token.balanceOf(signer.address);
  console.log(`\n💰 ${tokenName} Balance:`, hre.ethers.formatUnits(tokenBalance, 6), tokenName);

  if (tokenBalance === 0n) {
    console.log(`⚠️  No ${tokenName} balance. Please get some ${tokenName} first.`);
    return;
  }

  // Check approval
  const allowance = await token.allowance(signer.address, deployment.oappProxyOft);
  console.log(`   Approval:`, hre.ethers.formatUnits(allowance, 6), tokenName);

  // Test amount (0.1 USDC)
  const amount = hre.ethers.parseUnits("0.1", 6);
  const dstEid = network.chainId === 84532n ? 1315 : 40245; // Story Aeneid or Base Sepolia
  const recipient = hre.ethers.zeroPadValue(signer.address, 32);

  // Use combineOptions to properly encode options (fixes 0x6592671c error)
  const SEND = 1; // Message type for OFT send
  
  // Helper function to create minimal Type 3 options
  function createMinimalType3Options() {
    const TYPE_3 = 3;
    const WORKER_ID_EXECUTOR = 1;
    const OPTION_TYPE_LZRECEIVE = 1;
    const OPTION_SIZE = 17;
    const GAS = 0n;
    
    return hre.ethers.solidityPacked(
      ["uint16", "uint8", "uint16", "uint8", "uint128"],
      [TYPE_3, WORKER_ID_EXECUTOR, OPTION_SIZE, OPTION_TYPE_LZRECEIVE, GAS]
    );
  }
  
  let extraOptions = "0x";
  try {
    extraOptions = await proxyOft.combineOptions(dstEid, SEND, "0x");
    console.log("   combineOptions returned:", extraOptions);
    console.log("   Length:", extraOptions.length);
    
    // If combineOptions returns empty, use minimal Type 3 options
    if (extraOptions === "0x" || extraOptions.length < 2) {
      console.log("   ⚠️  combineOptions returned empty, using minimal Type 3 options");
      extraOptions = createMinimalType3Options();
      console.log("   ✅ Using minimal Type 3 options:", extraOptions);
    } else {
      console.log("   ✅ Options encoded using combineOptions");
    }
  } catch (e) {
    console.log("   ⚠️  combineOptions failed, using minimal Type 3 options:", e.message);
    extraOptions = createMinimalType3Options();
    console.log("   ✅ Using minimal Type 3 options:", extraOptions);
  }

  const sendParam = {
    dstEid: dstEid,
    to: recipient,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: extraOptions,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  console.log("\n📤 Testing quoteSend...");
  let nativeFee;
  try {
    [nativeFee] = await proxyOft.quoteSend(sendParam, false);

    console.log("   ✅ Quote successful!");
    console.log("   Native Fee:", hre.ethers.formatEther(nativeFee), network.chainId === 84532n ? "ETH" : "IP");
  } catch (error) {
    console.log("   ❌ Quote failed:", error.message);
    if (error.data) {
      console.log("   Error data:", error.data);
    }
    return;
  }

  // If approval is insufficient, approve (use generous amount to avoid allowance issues)
  const approveAmount = hre.ethers.parseUnits("100", 6);
  if (allowance < amount) {
    console.log(`\n🔐 Approving ${tokenName}...`);
    const approveTx = await token.approve(deployment.oappProxyOft, approveAmount);
    await approveTx.wait();
    console.log("   ✅ Approved");
  }

  console.log("\n📤 Sending cross-chain transfer...");
  console.log("   Amount:", hre.ethers.formatUnits(amount, 6), tokenName);
  console.log("   Destination EID:", dstEid, network.chainId === 84532n ? "(Story Aeneid)" : "(Base Sepolia)");
  console.log("   Recipient:", signer.address);

  try {
    const fee = {
      nativeFee,
      lzTokenFee: 0n,
    };

    const sendTx = await proxyOft.send(
      sendParam,
      fee,
      signer.address,
      { value: nativeFee }
    );

    const receipt = await sendTx.wait();
    console.log("\n   ✅ Transfer initiated!");
    console.log("   Tx Hash:", receipt.hash);
    console.log("   Block Explorer:", network.chainId === 84532n 
      ? `https://sepolia.basescan.org/tx/${receipt.hash}`
      : `https://aeneid.storyscan.io/tx/${receipt.hash}`);
    console.log("\n⏳ Wait for LayerZero to deliver the message (~1-2 minutes)...");
    console.log("   Check destination chain for received tokens.");
    console.log("\n💡 Tip: You can check the message status on LayerZero Scan");
  } catch (error) {
    console.log("\n   ❌ Transfer failed:", error.message);
    if (error.data) {
      console.log("   Error data:", error.data);
    }
    if (error.reason) {
      console.log("   Reason:", error.reason);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
