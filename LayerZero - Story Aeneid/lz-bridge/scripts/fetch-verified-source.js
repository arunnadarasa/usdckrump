/**
 * Fetch the verified source code from Etherscan and compare with local source
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  
  if (!apiKey) {
    console.log("⚠️  ETHERSCAN_API_KEY not set");
    console.log("   Please set it in .env file");
    return;
  }

  console.log("🔍 Fetching verified source code from Etherscan\n");
  console.log("Contract:", ownEndpoint.endpointV2);
  
  try {
    const response = await fetch(
      `https://api-sepolia.basescan.org/api?module=contract&action=getsourcecode&address=${ownEndpoint.endpointV2}&apikey=${apiKey}`
    );
    const data = await response.json();
    
    if (data.status === "1" && data.result[0].SourceCode) {
      console.log("✅ Source code retrieved\n");
      console.log("Contract Name:", data.result[0].ContractName);
      console.log("Compiler Version:", data.result[0].CompilerVersion);
      console.log("Optimization:", data.result[0].OptimizationUsed === "1" ? "Yes" : "No");
      console.log("Runs:", data.result[0].Runs || "N/A");
      console.log("EVM Version:", data.result[0].EVMVersion || "N/A");
      
      // Save the source code for comparison
      const sourceCode = data.result[0].SourceCode;
      
      // If it's a JSON object (standard JSON input format), parse it
      let parsedSource;
      try {
        parsedSource = JSON.parse(sourceCode);
        console.log("\n📄 Source code is in Standard JSON Input format");
        console.log("   Files:", Object.keys(parsedSource.sources || {}).length);
        
        // Save the full JSON
        fs.writeFileSync(
          "deployments/endpointv2-verified-source.json",
          JSON.stringify(parsedSource, null, 2)
        );
        console.log("   Saved to: deployments/endpointv2-verified-source.json");
        
        // Extract EndpointV2.sol if it exists
        const endpointV2Path = Object.keys(parsedSource.sources || {}).find(
          path => path.includes("EndpointV2.sol")
        );
        if (endpointV2Path) {
          fs.writeFileSync(
            "deployments/endpointv2-verified.sol",
            parsedSource.sources[endpointV2Path].content
          );
          console.log("   Extracted EndpointV2.sol to: deployments/endpointv2-verified.sol");
        }
      } catch (e) {
        // Not JSON, save as raw source
        fs.writeFileSync("deployments/endpointv2-verified.sol", sourceCode);
        console.log("\n📄 Source code saved to: deployments/endpointv2-verified.sol");
      }
      
      // Check constructor arguments
      if (data.result[0].ConstructorArguments) {
        console.log("\nConstructor Arguments:", data.result[0].ConstructorArguments);
        // Decode constructor args
        const iface = new hre.ethers.Interface([
          "constructor(uint32 _eid, address _owner)"
        ]);
        try {
          const decoded = iface.decodeDeploy(data.result[0].ConstructorArguments);
          console.log("   Decoded:");
          console.log("     _eid:", decoded[0].toString());
          console.log("     _owner:", decoded[1]);
        } catch (e) {
          console.log("   Could not decode:", e.message);
        }
      }
      
    } else {
      console.log("❌ Source code not found");
      console.log("   Response:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("❌ Error:", e.message);
  }
}

main().catch(console.error);
