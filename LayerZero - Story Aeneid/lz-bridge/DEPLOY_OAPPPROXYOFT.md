# OAppProxyOFT Deployment Guide

Quick reference guide for deploying and configuring OAppProxyOFT to bridge standard USDC.

## Prerequisites

- ✅ Hardhat configured with Base Sepolia and Story Aeneid networks
- ✅ Environment variables set in `.env`
- ✅ Standard USDC address on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- ✅ Wrapped USDC token on Story Aeneid (deploy or use existing)

## Step-by-Step Deployment

### 1. Compile Contracts

```bash
npm run build
```

### 2. Deploy on Base Sepolia

```bash
npm run deploy:proxy-oft -- --network baseSepolia
```

**Expected Output:**
```
✅ OAppProxyOFT deployed: 0x...
   Saved: deployments/oapp-proxy-oft-baseSepolia-latest.json
```

### 3. Deploy on Story Aeneid

**Important**: Set `STORY_AENEID_USDC` environment variable first:

```bash
export STORY_AENEID_USDC=0x... # Your wrapped USDC address
npm run deploy:proxy-oft -- --network storyAeneid
```

**Expected Output:**
```
✅ OAppProxyOFT deployed: 0x...
   Saved: deployments/oapp-proxy-oft-storyAeneid-latest.json
```

### 4. Verify Deployments

```bash
npm run check:proxy-oft
```

This will show:
- ✅ Deployment status for both chains
- ✅ Contract addresses
- ✅ Configuration status
- ✅ Next steps

### 5. Link Contracts (Set Peers)

Run on **Base Sepolia**:
```bash
npm run link:proxy-oft -- --network baseSepolia
```

Then run on **Story Aeneid**:
```bash
npm run link:proxy-oft -- --network storyAeneid
```

### 6. Configure LayerZero Libraries

**Base Sepolia** (using official LayerZero libraries):
```bash
npm run configure:proxy-oft -- --network baseSepolia
```

**Story Aeneid** (using self-deployed libraries):
```bash
npm run configure:proxy-oft -- --network storyAeneid
```

### 7. Test the Bridge

**On Base Sepolia:**
```bash
npm run test:proxy-oft -- --network baseSepolia
```

**On Story Aeneid:**
```bash
npm run test:proxy-oft -- --network storyAeneid
```

## Environment Variables

Add to `.env`:

```bash
# Base Sepolia
BASE_SEPOLIA_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
BASE_SEPOLIA_SEND_LIB=0x... # Official LayerZero SendUln302
BASE_SEPOLIA_RECEIVE_LIB=0x... # Official LayerZero ReceiveUln302

# Story Aeneid
STORY_AENEID_ENDPOINT=0xdB09C62692B837C6bd8E53dF33957E5f018A68B4
STORY_AENEID_USDC=0x... # Wrapped USDC address (REQUIRED)
STORY_AENEID_SEND_LIB=0x... # Self-deployed SendUln302
STORY_AENEID_RECEIVE_LIB=0x... # Self-deployed ReceiveUln302

# Common
DELEGATE_ADDRESS=0x... # Your delegate/owner address
PRIVATE_KEY=0x... # Your deployer private key
```

## Quick Checklist

- [ ] Contracts compiled (`npm run build`)
- [ ] Deployed on Base Sepolia
- [ ] Deployed on Story Aeneid (with wrapped USDC)
- [ ] Verified deployments (`npm run check:proxy-oft`)
- [ ] Linked contracts (peers set on both chains)
- [ ] Configured libraries (send/receive on both chains)
- [ ] Tested bridge functionality

## Troubleshooting

### "STORY_AENEID_USDC not set"
- Deploy a wrapped USDC token on Story Aeneid first
- Or use an existing wrapped USDC address
- Set `STORY_AENEID_USDC` in `.env` or export before deployment

### "Deployment file not found"
- Run the deployment script for that network first
- Check that `deployments/` directory exists

### "Quote failed"
- Verify peers are set correctly
- Check that libraries are configured
- Ensure endpoint addresses are correct

### "Approval required"
- Users must approve USDC to the OAppProxyOFT contract before bridging
- Unlike USDCKrumpOFT (which IS the token), OAppProxyOFT wraps external tokens

## Usage Example

```javascript
// 1. Approve USDC
const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
await usdc.approve(OAPPPROXYOFT_ADDRESS, amount);

// 2. Get quote
const proxyOft = await ethers.getContractAt("OAppProxyOFT", OAPPPROXYOFT_ADDRESS);
const quote = await proxyOft.quote({
  dstEid: 1315, // Story Aeneid
  to: recipientBytes32,
  amountLD: amount,
  minAmountLD: amount,
  extraOptions: "0x",
  composeMsg: "0x",
  oftCmd: "0x",
}, false);

// 3. Send
await proxyOft.send(
  {
    dstEid: 1315,
    to: recipientBytes32,
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  },
  quote,
  userAddress,
  { value: quote.nativeFee }
);
```

## Next Steps

After deployment:
1. Update your bridge UI to use OAppProxyOFT addresses
2. Users will see "USDC" instead of "USDC.k" in LayerZero bridge
3. Ensure users approve USDC before bridging
4. Monitor cross-chain transfers

## Support

For issues or questions:
- Check `OAPPPROXYOFT_README.md` for detailed documentation
- Review LayerZero V2 OFT documentation
- Check contract verification on block explorers
