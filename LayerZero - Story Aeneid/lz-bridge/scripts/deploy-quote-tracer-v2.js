/**
 * Deploy QuoteTracerV2 for detailed quote() tracing
 */
const hre = require("hardhat");

async function main() {
  const ownEndpoint = JSON.parse(fs.readFileSync("deployments/base-sepolia-own-latest.json", "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log("🔧 Deploying QuoteTracerV2\n");

  const QuoteTracerV2 = await hre.ethers.getContractFactory("QuoteTracerV2");
  const tracer = await QuoteTracerV2.deploy(ownEndpoint.endpointV2, ownEndpoint.sendUln302);
  await tracer.waitForDeployment();
  const tracerAddress = await tracer.getAddress();

  console.log("✅ QuoteTracerV2 deployed:", tracerAddress);
  console.log("\nUpdate deployments file with tracer address if needed.");
}

main().catch(console.error);
