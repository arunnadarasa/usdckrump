export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

export const BRIDGE_VAULT_ABI = [
  'function lock(uint256 amount, address destinationRecipient)',
] as const;

export const BRIDGE_RECEIVER_ABI = [
  'function lockBack(uint256 amount, address destinationRecipient)',
] as const;
