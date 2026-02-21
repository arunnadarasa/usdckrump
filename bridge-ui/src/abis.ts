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

export const USDCKRUMP_OFT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function quoteSend(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), bool payInLzToken) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function send(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), tuple(uint256 nativeFee, uint256 lzTokenFee), address refundTo) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee) msgReceipt, tuple(uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)',
] as const;
