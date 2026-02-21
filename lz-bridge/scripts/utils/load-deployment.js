const fs = require("fs");

/**
 * Load deployment JSON file
 * @param {string} chainName - "base-sepolia" or "story-aeneid"
 * @param {string} type - "layerzero" or "usdc"
 * @returns {object} Deployment object
 */
function loadDeployment(chainName, type = "layerzero") {
  const filename = type === "layerzero" 
    ? `deployments/${chainName}-latest.json`
    : `deployments/usdc-${chainName}-latest.json`;
  
  if (!fs.existsSync(filename)) {
    throw new Error(`Deployment file not found: ${filename}`);
  }
  
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

/**
 * Load all deployments
 * @returns {object} Object with base and story deployments
 */
function loadAllDeployments() {
  return {
    base: {
      layerzero: loadDeployment("base-sepolia", "layerzero"),
      usdc: loadDeployment("base-sepolia", "usdc")
    },
    story: {
      layerzero: loadDeployment("story-aeneid", "layerzero"),
      usdc: loadDeployment("story-aeneid", "usdc")
    }
  };
}

module.exports = {
  loadDeployment,
  loadAllDeployments
};
