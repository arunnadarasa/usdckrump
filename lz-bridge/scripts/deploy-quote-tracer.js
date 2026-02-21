/**
 * Deploy QuoteTracer contract to trace quote() execution
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🚀 Deploying QuoteTracer\n");

  const QuoteTracer = await hre.ethers.getContractFactory("QuoteTracer");
  const tracer = await QuoteTracer.deploy(ownEndpoint.endpointV2);
  await tracer.waitForDeployment();

  const tracerAddress = await tracer.getAddress();
  console.log("✅ QuoteTracer deployed:", tracerAddress);

  // Save deployment
  const deployment = {
    quoteTracer: tracerAddress,
    endpoint: ownEndpoint.endpointV2,
    deployer: signer.address,
    network: "base-sepolia",
    timestamp: Date.now()
  };

  fs.writeFileSync(
    "deployments/base-sepolia-quote-tracer.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n📋 Deployment saved to deployments/base-sepolia-quote-tracer.json");
}

main().catch(console.error);
