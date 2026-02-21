# Testing Guide

## Test Results Summary

### ✅ Configuration Tests

**Peer Linking:**
- ✅ Base Sepolia → Story Aeneid: Linked correctly
- ✅ Story Aeneid → Base Sepolia: Linked correctly

**Contract Deployments:**
- ✅ LayerZero Infrastructure on Story Aeneid
- ✅ USDCDanceOFT on both chains
- ✅ EVVMPaymentAdapter on Story Aeneid

### ⚠️ Cross-Chain Transfer Testing

**Status**: Requires test tokens

**Current State:**
- Peer linking verified ✅
- Contracts deployed ✅
- No USDC.d tokens available for testing ⚠️

**Next Steps:**
1. Obtain test tokens (see options below)
2. Run cross-chain transfer test
3. Verify tokens arrive on Story Aeneid

### ✅ EVVM Integration Testing

**Status**: Ready for testing

**Current State:**
- EVVMPaymentAdapter deployed ✅
- Domain separator available ✅
- Contract addresses verified ✅

**Requirements for Full Test:**
- USDC.d tokens on Story Aeneid
- EIP-712 signature for transferWithAuthorization
- EVVM signature for Core.pay()

## Getting Test Tokens

### Option 1: Add Mint Function (Testnet Only)

Add a mint function to `USDCDanceOFT.sol`:

```solidity
function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
}
```

Then run:
```bash
npm run mint:tokens -- baseSepolia
npm run mint:tokens -- storyAeneid
```

### Option 2: Bridge from Another Chain

If you have USDC.d on another chain:
1. Use LayerZero to bridge tokens
2. Tokens will be minted on destination chain automatically

### Option 3: Receive from Another Address

If another address has USDC.d:
1. Have them send tokens to your address
2. Or use transferWithAuthorization (x402) for gasless transfer

## Running Tests

### 1. Test Bridge Configuration
```bash
npm run test:bridge
```

### 2. Test Peer Linking (Network-Specific)
```bash
# On Base Sepolia
npx hardhat run scripts/test-bridge.js --network baseSepolia

# On Story Aeneid
npx hardhat run scripts/test-bridge.js --network storyAeneid
```

### 3. Test Cross-Chain Transfer
```bash
npm run test:cross-chain
```

**Requirements:**
- USDC.d tokens on Base Sepolia
- Sufficient ETH for gas fees
- ULN configuration (may be required)

### 4. Test EVVM Integration
```bash
npm run test:evvm
```

**Requirements:**
- USDC.d tokens on Story Aeneid
- EIP-712 signature generation
- EVVM signature generation

## ULN Configuration

For cross-chain transfers to work, ULN (Ultra Light Node) settings may need to be configured:

```bash
npm run configure:uln
```

This script provides guidance on:
- Per-OApp ULN configuration
- Default ULN settings
- DVN (Data Verification Network) setup

## Expected Test Flow

### Cross-Chain Transfer Test

1. **Pre-requisites:**
   - ✅ Contracts deployed
   - ✅ Peers linked
   - ⚠️ Test tokens available
   - ⚠️ ULN configured (if required)

2. **Send Transfer:**
   ```javascript
   // On Base Sepolia
   const amount = ethers.parseUnits("0.001", 6);
   await BaseOFT.send(sendParam, fee, sender);
   ```

3. **Wait for Delivery:**
   - LayerZero message delivery: ~1-2 minutes
   - Check Story Aeneid for minted tokens

4. **Verify:**
   - Check balance on Story Aeneid
   - Verify PaymentReceived event
   - Check payment info via getPaymentInfo()

### EVVM Payment Test

1. **Pre-requisites:**
   - ✅ EVVMPaymentAdapter deployed
   - ⚠️ USDC.d tokens available
   - ⚠️ Signatures generated

2. **Generate Signatures:**
   - EIP-712 signature for transferWithAuthorization
   - EVVM signature for Core.pay()

3. **Execute Payment:**
   ```javascript
   await adapter.payViaEVVMWithX402(
     from, to, toIdentity, amount,
     validAfter, validBefore, nonce,
     v, r, s,
     receiptId, evvmNonce, isAsyncExec, evvmSignature
   );
   ```

4. **Verify:**
   - Check EVVM payment receipt
   - Verify token transfer
   - Check EVVM balance

## Troubleshooting

### "Insufficient USDC.d balance"
- Mint test tokens or receive from another address
- See "Getting Test Tokens" section above

### "LZ_ULN_NotSet" error
- Configure ULN settings
- Run `npm run configure:uln` for guidance

### "Peer not configured"
- Run `npm run link:oft` to link OFT pairs
- Verify peers are set correctly

### "Message not delivered"
- Check ULN configuration
- Verify executor is running
- Check gas fees were sufficient

## Test Commands Reference

```bash
# Configuration tests
npm run test:bridge              # Test bridge configuration
npm run configure:uln            # Configure ULN settings

# Network-specific tests
npm run test:cross-chain         # Test cross-chain transfer (Base Sepolia)
npm run test:evvm                # Test EVVM integration (Story Aeneid)

# Minting (if mint function added)
npm run mint:tokens -- baseSepolia
npm run mint:tokens -- storyAeneid
```

## Next Steps

1. ✅ Configuration verified
2. ⚠️ Add mint function or obtain test tokens
3. ⚠️ Configure ULN settings (if required)
4. ⚠️ Run full cross-chain transfer test
5. ⚠️ Test EVVM payment flow
