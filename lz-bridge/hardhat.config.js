require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { 
      optimizer: { 
        enabled: true, 
        runs: 200  // Standard LayerZero V2 optimization
      },
      viaIR: true  // Required to avoid "stack too deep" errors
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  // Exclude test files and deprecated contracts from compilation
  exclude: [
    "**/node_modules/**",
    "**/test/**",
    "**/*.t.sol",
    "**/out/**",
    "**/DanceVerifyOFT.sol", // Deprecated, use USDCDanceOFT instead
    "**/*View*.sol", // Exclude View contracts that use hardhat-deploy
    "**/PriceFeed.sol",
    "**/LzExecutor.sol",
    "**/readlib/**",
    "**/SimpleMessageLib.sol" // Exclude SimpleMessageLib (not needed for deployment)
  ],
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      // Dynamic gas (omit gasPrice so network fee is used)
    },
    storyAeneid: {
      url: process.env.STORY_AENEID_RPC || "https://aeneid.storyrpc.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1315,
      gasPrice: 10000000000, // 10 gwei for Story Aeneid
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "",
      storyAeneid: "no-api-key-needed", // Blockscout doesn't require API key, but plugin needs a value
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "storyAeneid",
        chainId: 1315,
        urls: {
          apiURL: "https://aeneid.storyscan.io/api",
          browserURL: "https://aeneid.storyscan.io"
        }
      }
    ]
  },
  sourcify: {
    enabled: false // Story Aeneid (chainId 1315) not supported by Sourcify
  }
};
