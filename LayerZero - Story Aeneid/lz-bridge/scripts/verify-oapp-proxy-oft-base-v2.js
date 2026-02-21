const fs = require("fs");
const https = require("https");
const { ethers } = require("ethers");
require("dotenv").config();

/**
 * Verify OAppProxyOFT on Base Sepolia using Etherscan API V2
 * This script uses the Etherscan API V2 directly since Hardhat's verify plugin
 * doesn't fully support V2 yet.
 */
async function main() {

  const deployment = JSON.parse(
    fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
  );

  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY;
  if (!apiKey) {
    console.error("❌ ETHERSCAN_API_KEY not set in .env");
    console.log("   Get your API key from: https://etherscan.io/apis");
    process.exit(1);
  }

  console.log("🔍 Verifying OAppProxyOFT on BaseScan using Etherscan API V2");
  console.log("   Address:", deployment.oappProxyOft);
  console.log("   Chain ID: 84532 (Base Sepolia)");

  // Try flattened source first (smaller than Standard JSON)
  let useFlattened = true;
  let flattenedSource = null;
  let standardJsonInput = null;

  // Check if flattened file exists
  if (fs.existsSync("OAppProxyOFT-flattened.sol")) {
    flattenedSource = fs.readFileSync("OAppProxyOFT-flattened.sol", "utf8");
    console.log("   Using flattened source code");
  } else {
    console.log("   Flattened source not found, generating...");
    // Generate flattened source
    const { execSync } = require("child_process");
    try {
      execSync("npx hardhat flatten contracts/OAppProxyOFT.sol > OAppProxyOFT-flattened.sol", { stdio: "inherit" });
      flattenedSource = fs.readFileSync("OAppProxyOFT-flattened.sol", "utf8");
      console.log("   ✅ Flattened source generated");
    } catch (error) {
      console.log("   ⚠️  Could not generate flattened source, trying Standard JSON...");
      useFlattened = false;
    }
  }

  // Always try to get Standard JSON Input (required for viaIR)
  const buildInfoFiles = fs.readdirSync("artifacts/build-info").filter(f => f.endsWith(".json"));
  for (const file of buildInfoFiles) {
    const content = fs.readFileSync(`artifacts/build-info/${file}`, "utf8");
    if (content.includes("OAppProxyOFT")) {
      const buildInfo = JSON.parse(content);
      // Extract the input from build info
      if (buildInfo.input) {
        standardJsonInput = buildInfo.input;
        console.log("   Using Standard JSON Input from:", file);
        break;
      }
    }
  }

  if (!standardJsonInput) {
    console.error("❌ Could not find Standard JSON Input");
    console.log("   Run: npm run build");
    process.exit(1);
  }

  // Constructor arguments
  const constructorArgs = [
    deployment.wrappedToken,  // USDC address
    deployment.endpoint,       // LayerZero endpoint
    deployment.delegate,       // Delegate address
  ];

  console.log("   Constructor Args:", JSON.stringify(constructorArgs));

  // Base Sepolia chainid for Etherscan API V2
  // Note: Base Sepolia might use a different chainid in Etherscan's system
  // Try 84532 first, if that fails, we'll need to check the chainlist
  const chainId = 84532;

  // Get compiler version from build info if available
  let compilerVersion = "v0.8.20+commit.a1b79de6";
  if (standardJsonInput && standardJsonInput.solcVersion) {
    compilerVersion = standardJsonInput.solcVersion;
  }

  // Prepare verification data
  // Note: chainid is in URL, not in POST data for API V2
  const verificationData = {
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: deployment.oappProxyOft,
    compilerversion: compilerVersion,
    optimizationUsed: 1,
    runs: 1,
    constructorArguements: ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address"],
      constructorArgs
    ).slice(2), // Remove 0x prefix
  };

  // Use Standard JSON Input (required for viaIR)
  // Flattened source doesn't work well with viaIR compilation
  if (standardJsonInput) {
    verificationData.codeformat = "solidity-standard-json-input";
    // Compress the Standard JSON by removing unnecessary metadata
    const compressedInput = {
      language: standardJsonInput.language,
      sources: standardJsonInput.sources,
      settings: standardJsonInput.settings
    };
    verificationData.sourceCode = JSON.stringify(compressedInput);
    verificationData.contractname = "contracts/OAppProxyOFT.sol:OAppProxyOFT";
    console.log("   Using Standard JSON Input (compressed)");
  } else if (useFlattened && flattenedSource) {
    verificationData.codeformat = "solidity-single-file";
    verificationData.sourceCode = flattenedSource;
    verificationData.contractname = "OAppProxyOFT";
    console.log("   Using flattened source (fallback)");
  } else {
    console.error("❌ No source code available");
    process.exit(1);
  }

  // Submit verification
  const postData = Object.entries(verificationData)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  console.log("\n📤 Submitting verification request...");
  console.log("   Using chainid:", chainId);

  return new Promise((resolve, reject) => {
    // API V2 requires chainid in the URL path
    const options = {
      hostname: "api.etherscan.io",
      path: `/v2/api?chainid=${chainId}`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === "1" && result.result) {
            const guid = result.result;
            console.log("   ✅ Verification submitted!");
            console.log("   GUID:", guid);
            console.log("\n⏳ Checking verification status...");
            
            // Poll for verification status
            checkVerificationStatus(apiKey, guid, deployment.oappProxyOft, 0);
          } else {
            console.error("   ❌ Verification failed:", result.message || result.result);
            if (result.result) {
              console.error("   Details:", result.result);
            }
            reject(new Error(result.message || "Verification failed"));
          }
        } catch (error) {
          console.error("   ❌ Error parsing response:", error.message);
          console.error("   Response:", data);
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      console.error("   ❌ Request failed:", error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

function checkVerificationStatus(apiKey, guid, address, attempts) {
  const maxAttempts = 30;
  const delay = 5000; // 5 seconds

  if (attempts >= maxAttempts) {
    console.log("\n⚠️  Verification check timeout");
    console.log("   Check status manually:");
    console.log(`   https://sepolia.basescan.org/address/${address}#code`);
    return;
  }

  setTimeout(() => {
    const options = {
      hostname: "api.etherscan.io",
      path: `/v2/api?chainid=84532&module=contract&action=checkverifystatus&apikey=${apiKey}&guid=${guid}`,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === "1") {
            if (result.result === "Pending in queue" || result.result.includes("Pending")) {
              process.stdout.write(".");
              checkVerificationStatus(apiKey, guid, address, attempts + 1);
            } else if (result.result.includes("Successfully Verified") || result.result.includes("already verified") || result.result.includes("Pass - Verified")) {
              console.log("\n   ✅ Contract verified successfully!");
              console.log(`   https://sepolia.basescan.org/address/${address}#code`);
            } else {
              console.log("\n   📋 Status:", result.result);
              if (result.result.includes("Fail") || result.result.includes("Error")) {
                console.log("   ❌ Verification failed. Check BaseScan for details.");
                console.log(`   https://sepolia.basescan.org/address/${address}#code`);
                return;
              }
              checkVerificationStatus(apiKey, guid, address, attempts + 1);
            }
          } else {
            const message = result.message || result.result || "Unknown error";
            if (message.includes("Fail") || message.includes("Error") || message.includes("Invalid")) {
              console.log("\n   ❌ Verification failed:", message);
              console.log(`   Check BaseScan: https://sepolia.basescan.org/address/${address}#code`);
              return;
            }
            process.stdout.write(".");
            checkVerificationStatus(apiKey, guid, address, attempts + 1);
          }
        } catch (error) {
          console.log("\n   ⚠️  Error checking status:", error.message);
          checkVerificationStatus(apiKey, guid, address, attempts + 1);
        }
      });
    });

    req.on("error", (error) => {
      console.log("\n   ⚠️  Error:", error.message);
      checkVerificationStatus(apiKey, guid, address, attempts + 1);
    });

    req.end();
  }, delay);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
