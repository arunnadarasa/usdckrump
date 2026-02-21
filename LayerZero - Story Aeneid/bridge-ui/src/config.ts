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
  layerZeroEid: 40245, // LayerZero endpoint ID (not chain ID)
};

export const STORY_AENEID = {
  chainId: 1315,
  chainIdHex: '0x523',
  name: 'Story Aeneid',
  rpcUrl: 'https://aeneid.storyrpc.io',
  blockExplorer: 'https://aeneid.storyscan.io',
  layerZeroEid: 1315, // LayerZero endpoint ID (same as chain ID)
};

export const CONTRACTS = {
  baseSepolia: {
    bridgeVault: '0xa594b9F302D411A7c2bB7d599eb7C635f3535b00' as const,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
    usdcKrumpOft: '0xACb294d6EB0544D968bd383F88255Cd850b0076b' as const, // LayerZero OFT (old - deprecated)
    oappProxyOft: '0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627' as const, // OAppProxyOFT - wraps standard USDC (verified)
  },
  storyAeneid: {
    bridgeUsdc: '0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5' as const,
    bridgeReceiver: '0x1fd17eEAe696F06C4Dd367EB71aC9a3D0ab5224C' as const,
    usdcKrumpOft: '0x6739338727d896640Efce1499BCD8ee92604E3EA' as const, // LayerZero OFT (old - deprecated)
    oappProxyOft: '0xD4F9d22A3ca73Dfe117C641A1F492Bf49B0B2E86' as const, // OAppProxyOFT - wraps wrapped USDC
    wrappedUsdc: '0x55F6D2aa8BFd3aCb35D743c883FfD0336E767a29' as const, // WrappedUSDC token
  },
} as const;

export const USDC_DECIMALS = 6;

export const STREETKODE_LINK = 'https://asura.lovable.app/';
