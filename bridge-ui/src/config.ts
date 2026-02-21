const BASE_SEPOLIA_RPC =
  typeof import.meta.env?.VITE_BASE_SEPOLIA_RPC === 'string' && import.meta.env.VITE_BASE_SEPOLIA_RPC
    ? import.meta.env.VITE_BASE_SEPOLIA_RPC
    : 'https://base-sepolia.g.alchemy.com/v2/e-b8dKqY5geCHGIk_B7wl';

export const BASE_SEPOLIA = {
  chainId: 84532,
  chainIdHex: '0x14a34',
  name: 'Base Sepolia',
  rpcUrl: BASE_SEPOLIA_RPC,
  blockExplorer: 'https://sepolia.basescan.org',
};

export const STORY_AENEID = {
  chainId: 1315,
  chainIdHex: '0x523',
  name: 'Story Aeneid',
  rpcUrl: 'https://aeneid.storyrpc.io',
  blockExplorer: 'https://aeneid.storyscan.io',
};

export const CONTRACTS = {
  baseSepolia: {
    bridgeVault: '0x8e8bc0A151311e3E7Ed2c0AA514fbbB4a0284a04' as const,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
  },
  storyAeneid: {
    bridgeUsdc: '0x5f7aEf47131ab78a528eC939ac888D15FcF40C40' as const,
    bridgeReceiver: '0x331fAE45db0D9b283247c2B092959c3bcd531D77' as const,
  },
} as const;

export const USDC_DECIMALS = 6;

export const STREETKODE_LINK = 'https://asura.lovable.app/';
