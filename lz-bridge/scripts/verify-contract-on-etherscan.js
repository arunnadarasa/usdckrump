/**
 * Verify the EndpointV2 contract on Etherscan to check if it matches the source
 * This will help identify if there's a deployment/compilation mismatch
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  
  console.log("🔍 Verifying EndpointV2 contract on Etherscan\n");
  console.log("Contract address:", ownEndpoint.endpointV2);
  console.log("Network: Base Sepolia");
  console.log("\nTo verify manually:");
  console.log("1. Go to: https://sepolia.basescan.org/address/" + ownEndpoint.endpointV2);
  console.log("2. Click 'Contract' tab");
  console.log("3. Check if contract is verified");
  console.log("4. If verified, compare source code with provided source");
  
  // Try to verify using hardhat-verify
  console.log("\nAttempting automated verification...");
  try {
    await hre.run("verify:verify", {
      address: ownEndpoint.endpointV2,
      constructorArguments: [84532, ownEndpoint.owner || "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"],
      contract: "contracts/layerzero-infra/protocol/EndpointV2.sol:EndpointV2"
    });
    console.log("✅ Contract verified successfully");
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified");
    } else {
      console.log("⚠️  Verification failed:", e.message);
      console.log("   This might indicate a source mismatch");
    }
  }
  
  // Check if we can read the contract's source code from Etherscan API
  console.log("\nChecking contract source via Etherscan API...");
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  if (apiKey) {
    try {
      const response = await fetch(
        `https://api-sepolia.basescan.org/api?module=contract&action=getsourcecode&address=${ownEndpoint.endpointV2}&apikey=${apiKey}`
      );
      const data = await response.json();
      if (data.status === "1" && data.result[0].SourceCode) {
        console.log("✅ Source code found on Etherscan");
        console.log("   Contract Name:", data.result[0].ContractName);
        console.log("   Compiler Version:", data.result[0].CompilerVersion);
        console.log("   Optimization Used:", data.result[0].OptimizationUsed);
      } else {
        console.log("⚠️  Source code not found or not verified");
      }
    } catch (e) {
      console.log("   Error:", e.message);
    }
  } else {
    console.log("   ETHERSCAN_API_KEY not set, skipping API check");
  }
  
  console.log("\n✅ Check complete");
  console.log("\nNext steps:");
  console.log("1. Verify the contract matches the provided source code");
  console.log("2. Check if there are any compiler optimizations that might affect storage layout");
  console.log("3. Verify the inheritance order matches: MessagingChannel, MessageLibManager, MessagingComposer, MessagingContext");
}

main().catch(console.error);
