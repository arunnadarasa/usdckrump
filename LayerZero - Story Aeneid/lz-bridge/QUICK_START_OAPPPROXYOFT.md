# Quick Start: OAppProxyOFT Deployment

Complete step-by-step guide to deploy OAppProxyOFT for bridging standard USDC.

## ✅ Pre-Deployment Checklist

Run this first to verify your setup:

```bash
npm run verify:proxy-oft-setup
```

This checks:
- ✅ Environment variables
- ✅ Network connectivity  
- ✅ Account balances
- ✅ USDC addresses

## 🚀 Complete Deployment Flow

### Step 1: Deploy Wrapped USDC on Story Aeneid

Since Story Aeneid doesn't have standard USDC, deploy a wrapped version:

```bash
npm run deploy:wrapped-usdc -- --network storyAeneid
```

**Output:**
```
✅ WrappedUSDC deployed: 0x...
   Saved: deployments/wrapped-usdc-storyAeneid-latest.json
```

**Add to `.env`:**
```bash
STORY_AENEID_USDC=0x... # From deployment output
```

### Step 2: Deploy OAppProxyOFT on Base Sepolia

```bash
npm run deploy:proxy-oft -- --network baseSepolia
```

**Output:**
```
✅ OAppProxyOFT deployed: 0x...
   Saved: deployments/oapp-proxy-oft-baseSepolia-latest.json
```

### Step 3: Deploy OAppProxyOFT on Story Aeneid

```bash
npm run deploy:proxy-oft -- --network storyAeneid
```

**Output:**
```
✅ OAppProxyOFT deployed: 0x...
   Saved: deployments/oapp-proxy-oft-storyAeneid-latest.json
```

### Step 4: Verify Deployments

```bash
npm run check:proxy-oft
```

This shows deployment status and configuration.

### Step 5: Link Contracts (Set Peers)

**On Base Sepolia:**
```bash
npm run link:proxy-oft -- --network baseSepolia
```

**On Story Aeneid:**
```bash
npm run link:proxy-oft -- --network storyAeneid
```

### Step 6: Configure LayerZero Libraries

**Base Sepolia:**
```bash
npm run configure:proxy-oft -- --network baseSepolia
```

**Story Aeneid:**
```bash
npm run configure:proxy-oft -- --network storyAeneid
```

### Step 7: Test the Bridge

**On Base Sepolia:**
```bash
npm run test:proxy-oft -- --network baseSepolia
```

This will:
1. Check your USDC balance
2. Get a quote for bridging
3. Approve USDC (if needed)
4. Send a test transfer

## 📋 All Commands Summary

```bash
# 1. Verify setup
npm run verify:proxy-oft-setup

# 2. Deploy wrapped USDC (Story Aeneid only)
npm run deploy:wrapped-usdc -- --network storyAeneid

# 3. Deploy OAppProxyOFT
npm run deploy:proxy-oft -- --network baseSepolia
npm run deploy:proxy-oft -- --network storyAeneid

# 4. Check status
npm run check:proxy-oft

# 5. Link contracts
npm run link:proxy-oft -- --network baseSepolia
npm run link:proxy-oft -- --network storyAeneid

# 6. Configure libraries
npm run configure:proxy-oft -- --network baseSepolia
npm run configure:proxy-oft -- --network storyAeneid

# 7. Test
npm run test:proxy-oft -- --network baseSepolia
```

## 🔧 Environment Variables

Make sure your `.env` has:

```bash
# Required
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC=https://...
STORY_AENEID_RPC=https://...
STORY_AENEID_USDC=0x... # After deploying WrappedUSDC

# Optional (with defaults)
BASE_SEPOLIA_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
STORY_AENEID_ENDPOINT=0xdB09C62692B837C6bd8E53dF33957E5f018A68B4
DELEGATE_ADDRESS=0x... # Defaults to deployer
```

## 🎯 What This Achieves

After deployment, users can:

1. **Bridge Standard USDC** (not USDC.k)
2. **See "USDC" in LayerZero bridge UI**
3. **Use existing USDC tokens** (no need for custom token)

## ⚠️ Important Notes

1. **Approval Required**: Users must approve USDC to OAppProxyOFT before bridging
2. **Single Lockbox**: Only one OAppProxyOFT per token per chain
3. **Wrapped USDC**: Story Aeneid needs wrapped USDC (deploy with `deploy:wrapped-usdc`)

## 🐛 Troubleshooting

### "STORY_AENEID_USDC not set"
```bash
# Deploy wrapped USDC first
npm run deploy:wrapped-usdc -- --network storyAeneid
# Then add to .env
export STORY_AENEID_USDC=0x...
```

### "Quote failed"
- Check peers are set: `npm run check:proxy-oft`
- Verify libraries configured
- Ensure endpoint addresses correct

### "Insufficient balance"
- Get testnet ETH from faucets
- Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Story Aeneid: Check Story documentation

## 📚 Additional Resources

- `OAPPPROXYOFT_README.md` - Detailed documentation
- `DEPLOY_OAPPPROXYOFT.md` - Deployment reference
- LayerZero V2 Docs: https://docs.layerzero.network/v2

## ✨ Success Indicators

You'll know it's working when:

✅ `npm run check:proxy-oft` shows both deployments  
✅ `npm run test:proxy-oft` gets a quote successfully  
✅ Bridge UI shows "USDC" instead of "USDC.k"  
✅ Cross-chain transfers complete

---

**Ready to deploy?** Start with: `npm run verify:proxy-oft-setup`
