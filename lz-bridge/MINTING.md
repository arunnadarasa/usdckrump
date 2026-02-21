# Minting Test Tokens

## Overview

The `USDCDanceOFT` contract now includes a `mint()` function for testnet testing purposes. This function is **owner-only** and should only be used on testnets.

## Mint Function

```solidity
function mint(address to, uint256 amount) external onlyOwner
```

**Parameters:**
- `to`: The address to mint tokens to
- `amount`: The amount of tokens to mint (in token decimals, 6 for USDC.d)

**Requirements:**
- Only the contract owner can call this function
- `to` cannot be the zero address
- `amount` must be greater than zero

**Events:**
- `TokensMinted(address indexed to, uint256 amount, address indexed minter)`

## Usage

### 1. Compile the Contract

```bash
cd lz-bridge
npx hardhat compile
```

### 2. Redeploy Contracts (if needed)

If you've already deployed contracts without the mint function, you'll need to redeploy:

```bash
# Deploy to Base Sepolia
npm run deploy:oft -- baseSepolia

# Deploy to Story Aeneid
npm run deploy:oft -- storyAeneid
```

### 3. Mint Test Tokens

```bash
# Mint on Base Sepolia
npm run mint:tokens -- --network baseSepolia

# Mint on Story Aeneid
npm run mint:tokens -- --network storyAeneid
```

The script will:
- ✅ Verify you're the contract owner
- ✅ Mint 100 USDC.d to your address
- ✅ Display your new balance

## Example Output

```
💰 Minting Test Tokens

============================================================
Network: base-sepolia (Chain ID: 84532)
Deployer/Owner: 0x35df28Db852f528282Dd26AAa0C3968aac1d3a25

Contract: 0x6a7f89eB3879FeF28Ad37022Eee9e1316284A21b

✅ Deployer is the contract owner

Minting 100.0 USDC.d to 0x35df28Db852f528282Dd26AAa0C3968aac1d3a25...

⏳ Transaction submitted: 0x...
   Waiting for confirmation...

✅ Tokens minted successfully!
   Block: 12345678
   Gas Used: 45000

💰 New Balance: 100.0 USDC.d

============================================================

✅ Ready for testing!
   You can now run cross-chain transfer tests.
```

## Testing Cross-Chain Transfers

After minting tokens, you can test cross-chain transfers:

```bash
# Test cross-chain transfer from Base Sepolia to Story Aeneid
npm run test:cross-chain
```

## Security Notes

⚠️ **Important:**
- This mint function is **testnet-only**
- For production, tokens should only be minted through LayerZero cross-chain transfers
- The function is protected by `onlyOwner` modifier
- Consider removing or disabling this function before mainnet deployment

## Troubleshooting

### "Deployer is not the contract owner"
- Check that you're using the same address that deployed the contract
- Verify the owner address in the deployment JSON file

### "Cannot mint to zero address"
- Ensure you're providing a valid recipient address

### "Amount must be greater than zero"
- Check that the amount parameter is correctly formatted
- Remember: USDC.d uses 6 decimals (e.g., `100000000` = 100 USDC.d)

## Next Steps

1. ✅ Mint test tokens on both chains
2. ✅ Test cross-chain transfers
3. ✅ Verify tokens arrive on destination chain
4. ✅ Test EVVM integration with tokens
