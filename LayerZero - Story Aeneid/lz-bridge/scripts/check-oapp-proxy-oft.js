const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔍 Checking OAppProxyOFT deployment status\n");

  const networks = [
    { name: "baseSepolia", chainId: 84532, eid: 40245 },
    { name: "storyAeneid", chainId: 1315, eid: 1315 },
  ];

  for (const net of networks) {
    console.log(`\n📡 ${net.name} (Chain ID: ${net.chainId}, EID: ${net.eid})`);
    console.log("─".repeat(50));

    const deploymentFile = `deployments/oapp-proxy-oft-${net.name}-latest.json`;

    try {
      const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
      console.log("✅ Deployment file found");
      console.log("   OAppProxyOFT:", deployment.oappProxyOft);
      console.log("   Wrapped Token:", deployment.wrappedToken);
      console.log("   Endpoint:", deployment.endpoint);
      console.log("   Delegate:", deployment.delegate);
      console.log("   Deployed:", deployment.deployedAt);

      // Try to connect and verify
      try {
        const provider = hre.ethers.provider;
        const code = await provider.getCode(deployment.oappProxyOft);
        
        if (code === "0x") {
          console.log("   ⚠️  Contract not deployed at this address");
        } else {
          console.log("   ✅ Contract is deployed");

          const proxyOft = await hre.ethers.getContractAt(
            "OAppProxyOFT",
            deployment.oappProxyOft
          );

          // Check wrapped token
          const wrappedToken = await proxyOft.token();
          console.log("   Wrapped Token (from contract):", wrappedToken);

          // Check if approval is required
          const approvalRequired = await proxyOft.approvalRequired();
          console.log("   Approval Required:", approvalRequired);

          // Check owner
          try {
            const owner = await proxyOft.owner();
            console.log("   Owner:", owner);
          } catch (e) {
            console.log("   Owner: (not available)");
          }

          // Check peers
          try {
            const basePeer = await proxyOft.peers(40245);
            const storyPeer = await proxyOft.peers(1315);
            console.log("   Peer (Base Sepolia):", basePeer !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? basePeer : "Not set");
            console.log("   Peer (Story Aeneid):", storyPeer !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? storyPeer : "Not set");
          } catch (e) {
            console.log("   Peers: (check failed)");
          }
        }
      } catch (error) {
        console.log("   ⚠️  Could not verify contract:", error.message);
      }
    } catch (error) {
      console.log("❌ Deployment file not found:", deploymentFile);
      console.log("   Run: npm run deploy:proxy-oft -- --network", net.name);
    }
  }

  // Check if contracts are linked
  console.log("\n🔗 Cross-Chain Linking Status");
  console.log("─".repeat(50));

  try {
    const baseDeployment = JSON.parse(
      fs.readFileSync("deployments/oapp-proxy-oft-baseSepolia-latest.json", "utf8")
    );
    const storyDeployment = JSON.parse(
      fs.readFileSync("deployments/oapp-proxy-oft-storyAeneid-latest.json", "utf8")
    );

    console.log("✅ Both deployments found");
    console.log("   Base Sepolia:", baseDeployment.oappProxyOft);
    console.log("   Story Aeneid:", storyDeployment.oappProxyOft);
    console.log("\n📝 Next steps:");
    console.log("   1. Link contracts: npm run link:proxy-oft");
    console.log("   2. Configure libraries: npm run configure:proxy-oft -- --network baseSepolia");
    console.log("   3. Configure libraries: npm run configure:proxy-oft -- --network storyAeneid");
  } catch (error) {
    console.log("⚠️  Cannot check linking - one or both deployments missing");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
