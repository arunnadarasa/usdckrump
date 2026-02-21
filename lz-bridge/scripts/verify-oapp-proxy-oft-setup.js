const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  console.log("🔍 Verifying OAppProxyOFT Deployment Setup\n");
  console.log("=".repeat(60));

  let allGood = true;

  // 1. Check environment variables
  console.log("\n📋 Environment Variables:");
  console.log("-".repeat(60));

  const requiredVars = {
    "PRIVATE_KEY": process.env.PRIVATE_KEY,
    "BASE_SEPOLIA_RPC": process.env.BASE_SEPOLIA_RPC,
    "STORY_AENEID_RPC": process.env.STORY_AENEID_RPC,
  };

  const optionalVars = {
    "BASE_SEPOLIA_ENDPOINT": process.env.BASE_SEPOLIA_ENDPOINT || "0x6EDCE65403992e310A62460808c4b910D972f10f",
    "STORY_AENEID_ENDPOINT": process.env.STORY_AENEID_ENDPOINT || "0xdB09C62692B837C6bd8E53dF33957E5f018A68B4",
    "STORY_AENEID_USDC": process.env.STORY_AENEID_USDC,
    "DELEGATE_ADDRESS": process.env.DELEGATE_ADDRESS,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`✅ ${key}: Set`);
    } else {
      console.log(`❌ ${key}: Missing (REQUIRED)`);
      allGood = false;
    }
  }

  for (const [key, value] of Object.entries(optionalVars)) {
    if (value && value !== "0x0000000000000000000000000000000000000000") {
      console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      if (key === "STORY_AENEID_USDC") {
        console.log(`⚠️  ${key}: Not set (REQUIRED for Story Aeneid deployment)`);
        allGood = false;
      } else {
        console.log(`⚠️  ${key}: Using default or not set`);
      }
    }
  }

  // 2. Check network connectivity
  console.log("\n🌐 Network Connectivity:");
  console.log("-".repeat(60));

  try {
    const baseProvider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
    const baseBlock = await baseProvider.getBlockNumber();
    console.log(`✅ Base Sepolia: Connected (Block: ${baseBlock})`);
  } catch (error) {
    console.log(`❌ Base Sepolia: Connection failed - ${error.message}`);
    allGood = false;
  }

  try {
    const storyProvider = new hre.ethers.JsonRpcProvider(process.env.STORY_AENEID_RPC);
    const storyBlock = await storyProvider.getBlockNumber();
    console.log(`✅ Story Aeneid: Connected (Block: ${storyBlock})`);
  } catch (error) {
    console.log(`❌ Story Aeneid: Connection failed - ${error.message}`);
    allGood = false;
  }

  // 3. Check account balance
  console.log("\n💰 Account Balance:");
  console.log("-".repeat(60));

  if (process.env.PRIVATE_KEY) {
    try {
      const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
      console.log(`Account: ${wallet.address}`);

      try {
        const baseProvider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
        const baseBalance = await baseProvider.getBalance(wallet.address);
        const baseEth = hre.ethers.formatEther(baseBalance);
        if (parseFloat(baseEth) > 0.001) {
          console.log(`✅ Base Sepolia: ${baseEth} ETH`);
        } else {
          console.log(`⚠️  Base Sepolia: ${baseEth} ETH (Low balance, may need more for deployment)`);
        }
      } catch (error) {
        console.log(`❌ Base Sepolia: Could not check balance`);
      }

      try {
        const storyProvider = new hre.ethers.JsonRpcProvider(process.env.STORY_AENEID_RPC);
        const storyBalance = await storyProvider.getBalance(wallet.address);
        const storyEth = hre.ethers.formatEther(storyBalance);
        if (parseFloat(storyEth) > 0.001) {
          console.log(`✅ Story Aeneid: ${storyEth} ETH`);
        } else {
          console.log(`⚠️  Story Aeneid: ${storyEth} ETH (Low balance, may need more for deployment)`);
        }
      } catch (error) {
        console.log(`❌ Story Aeneid: Could not check balance`);
      }
    } catch (error) {
      console.log(`❌ Could not check account: ${error.message}`);
    }
  }

  // 4. Check USDC addresses
  console.log("\n💵 USDC Token Addresses:");
  console.log("-".repeat(60));

  const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  console.log(`✅ Base Sepolia USDC: ${BASE_SEPOLIA_USDC}`);

  if (process.env.STORY_AENEID_USDC) {
    console.log(`✅ Story Aeneid USDC: ${process.env.STORY_AENEID_USDC}`);
    
    // Verify it's a contract
    try {
      const storyProvider = new hre.ethers.JsonRpcProvider(process.env.STORY_AENEID_RPC);
      const code = await storyProvider.getCode(process.env.STORY_AENEID_USDC);
      if (code !== "0x") {
        console.log(`   ✅ Contract verified on Story Aeneid`);
      } else {
        console.log(`   ⚠️  Address may not be a contract`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not verify contract`);
    }
  } else {
    console.log(`❌ Story Aeneid USDC: Not set`);
    console.log(`   📝 You need to deploy or specify a wrapped USDC token on Story Aeneid`);
    console.log(`   Example: export STORY_AENEID_USDC=0x...`);
  }

  // 5. Check existing deployments
  console.log("\n📦 Existing Deployments:");
  console.log("-".repeat(60));

  const baseDeploymentFile = "deployments/oapp-proxy-oft-baseSepolia-latest.json";
  const storyDeploymentFile = "deployments/oapp-proxy-oft-storyAeneid-latest.json";

  if (fs.existsSync(baseDeploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(baseDeploymentFile, "utf8"));
    console.log(`✅ Base Sepolia: ${deployment.oappProxyOft}`);
  } else {
    console.log(`⚠️  Base Sepolia: Not deployed yet`);
  }

  if (fs.existsSync(storyDeploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(storyDeploymentFile, "utf8"));
    console.log(`✅ Story Aeneid: ${deployment.oappProxyOft}`);
  } else {
    console.log(`⚠️  Story Aeneid: Not deployed yet`);
  }

  // 6. Summary
  console.log("\n" + "=".repeat(60));
  if (allGood) {
    console.log("✅ Setup looks good! Ready for deployment.");
    console.log("\n📝 Next steps:");
    console.log("   1. npm run deploy:proxy-oft -- --network baseSepolia");
    if (process.env.STORY_AENEID_USDC) {
      console.log("   2. npm run deploy:proxy-oft -- --network storyAeneid");
      console.log("   3. npm run link:proxy-oft -- --network baseSepolia");
      console.log("   4. npm run link:proxy-oft -- --network storyAeneid");
    } else {
      console.log("   2. Set STORY_AENEID_USDC and deploy on Story Aeneid");
    }
  } else {
    console.log("❌ Setup incomplete. Please fix the issues above.");
    console.log("\n📝 Required fixes:");
    if (!process.env.PRIVATE_KEY) {
      console.log("   - Set PRIVATE_KEY in .env");
    }
    if (!process.env.BASE_SEPOLIA_RPC) {
      console.log("   - Set BASE_SEPOLIA_RPC in .env");
    }
    if (!process.env.STORY_AENEID_RPC) {
      console.log("   - Set STORY_AENEID_RPC in .env");
    }
    if (!process.env.STORY_AENEID_USDC) {
      console.log("   - Set STORY_AENEID_USDC in .env (wrapped USDC address)");
    }
  }
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
