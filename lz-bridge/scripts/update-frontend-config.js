const fs = require("fs");
const path = require("path");

/**
 * Updates frontend config.ts with new contract addresses from deployment files
 */

const FRONTEND_CONFIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "bridge-ui",
  "src",
  "config.ts"
);

function main() {
  console.log("🔄 Updating frontend config.ts...\n");

  // Load deployment files
  let wrappedUsdcDeployment, proxyOftStoryDeployment, proxyOftBaseDeployment;

  try {
    wrappedUsdcDeployment = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "deployments", "wrapped-usdc-storyAeneid-latest.json"),
        "utf8"
      )
    );
    console.log("✅ Loaded WrappedUSDC deployment:", wrappedUsdcDeployment.wrappedUSDC);
  } catch (error) {
    console.warn("⚠️  Could not load WrappedUSDC deployment:", error.message);
  }

  try {
    proxyOftStoryDeployment = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "deployments", "oapp-proxy-oft-storyAeneid-latest.json"),
        "utf8"
      )
    );
    console.log("✅ Loaded Story Aeneid OAppProxyOFT deployment:", proxyOftStoryDeployment.oappProxyOft);
  } catch (error) {
    console.warn("⚠️  Could not load Story Aeneid OAppProxyOFT deployment:", error.message);
  }

  try {
    proxyOftBaseDeployment = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "deployments", "oapp-proxy-oft-baseSepolia-latest.json"),
        "utf8"
      )
    );
    console.log("✅ Loaded Base Sepolia OAppProxyOFT deployment:", proxyOftBaseDeployment.oappProxyOft);
  } catch (error) {
    console.warn("⚠️  Could not load Base Sepolia OAppProxyOFT deployment:", error.message);
  }

  // Read current config
  let configContent;
  try {
    configContent = fs.readFileSync(FRONTEND_CONFIG_PATH, "utf8");
  } catch (error) {
    console.error("❌ Error: Could not read frontend config.ts");
    console.error("   Path:", FRONTEND_CONFIG_PATH);
    console.error("   Error:", error.message);
    process.exit(1);
  }

  let updated = false;

  // Update wrappedUsdc address
  if (wrappedUsdcDeployment) {
    const oldPattern = /wrappedUsdc:\s*'0x[a-fA-F0-9]+'/;
    const newValue = `wrappedUsdc: '${wrappedUsdcDeployment.wrappedUSDC}'`;
    if (oldPattern.test(configContent)) {
      configContent = configContent.replace(oldPattern, newValue);
      updated = true;
      console.log("   ✅ Updated wrappedUsdc address");
    } else {
      console.warn("   ⚠️  Could not find wrappedUsdc in config to update");
    }
  }

  // Update Story Aeneid oappProxyOft address
  if (proxyOftStoryDeployment) {
    const oldPattern = /storyAeneid:\s*\{[\s\S]*?oappProxyOft:\s*'0x[a-fA-F0-9]+'/;
    const storyAeneidSection = configContent.match(/storyAeneid:\s*\{[\s\S]*?\}/);
    if (storyAeneidSection) {
      const updatedSection = storyAeneidSection[0].replace(
        /oappProxyOft:\s*'0x[a-fA-F0-9]+'/,
        `oappProxyOft: '${proxyOftStoryDeployment.oappProxyOft}'`
      );
      configContent = configContent.replace(storyAeneidSection[0], updatedSection);
      updated = true;
      console.log("   ✅ Updated Story Aeneid oappProxyOft address");
    } else {
      console.warn("   ⚠️  Could not find storyAeneid section in config to update");
    }
  }

  // Update Base Sepolia oappProxyOft address
  if (proxyOftBaseDeployment) {
    const baseSepoliaSection = configContent.match(/baseSepolia:\s*\{[\s\S]*?\}/);
    if (baseSepoliaSection) {
      const updatedSection = baseSepoliaSection[0].replace(
        /oappProxyOft:\s*'0x[a-fA-F0-9]+'/,
        `oappProxyOft: '${proxyOftBaseDeployment.oappProxyOft}'`
      );
      configContent = configContent.replace(baseSepoliaSection[0], updatedSection);
      updated = true;
      console.log("   ✅ Updated Base Sepolia oappProxyOft address");
    } else {
      console.warn("   ⚠️  Could not find baseSepolia section in config to update");
    }
  }

  if (updated) {
    // Write updated config
    fs.writeFileSync(FRONTEND_CONFIG_PATH, configContent, "utf8");
    console.log("\n✅ Frontend config.ts updated successfully!");
    console.log("   Path:", FRONTEND_CONFIG_PATH);
  } else {
    console.log("\n⚠️  No updates were made. Check deployment files exist.");
  }
}

main();
