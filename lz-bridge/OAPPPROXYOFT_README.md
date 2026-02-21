# OAppProxyOFT - Wrapping Standard USDC for LayerZero Bridging

This contract wraps **standard USDC** (Circle's USDC) for LayerZero V2 cross-chain bridging, allowing you to bridge actual USDC instead of a custom token.

## Overview

`OAppProxyOFT` uses LayerZero's `OFTAdapter` pattern to wrap existing ERC20 tokens. Unlike `USDCKrumpOFT` (which creates a new token "USDC.k"), this contract wraps the **standard USDC token** that already exists on each chain.

### How It Works

1. **Base Sepolia**: Wraps Circle's USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
2. **Story Aeneid**: Wraps a wrapped USDC token (you'll need to deploy or use an existing wrapped USDC)

When users bridge:
- **Source Chain**: USDC is locked in the `OAppProxyOFT` contract
- **LayerZero**: Routes the message cross-chain
- **Destination Chain**: USDC is unlocked from the `OAppProxyOFT` contract

## Deployment

### Prerequisites

- Standard USDC address on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- LayerZero Endpoint addresses for both chains
- For Story Aeneid: A wrapped USDC token address (or deploy one)

### Step 1: Deploy on Base Sepolia

```bash
npm run deploy:proxy-oft -- --network baseSepolia
```

This will:
- Deploy `OAppProxyOFT` wrapping Circle's USDC
- Use the official LayerZero endpoint on Base Sepolia
- Save deployment info to `deployments/oapp-proxy-oft-baseSepolia-latest.json`

### Step 2: Deploy on Story Aeneid

**Important**: You need a wrapped USDC token on Story Aeneid first. Options:

1. **Deploy a simple wrapped USDC** (recommended for testing)
2. **Use an existing wrapped USDC** if available

Set the `STORY_AENEID_USDC` environment variable:

```bash
export STORY_AENEID_USDC=0x... # Your wrapped USDC address
npm run deploy:proxy-oft -- --network storyAeneid
```

### Step 3: Link the Contracts

Set peers between Base Sepolia and Story Aeneid:

```bash
npm run link:proxy-oft
```

This sets up bidirectional peer relationships.

### Step 4: Configure LayerZero Libraries

Configure send/receive libraries for each chain:

```bash
# Base Sepolia
npm run configure:proxy-oft -- --network baseSepolia

# Story Aeneid
npm run configure:proxy-oft -- --network storyAeneid
```

## Usage

### For Users: Bridging USDC

1. **Approve USDC** to the `OAppProxyOFT` contract:
   ```javascript
   const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
   await usdc.approve(OAPPPROXYOFT_ADDRESS, amount);
   ```

2. **Bridge USDC**:
   ```javascript
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

### Testing

Test the bridge:

```bash
# Test on Base Sepolia
npm run test:proxy-oft -- --network baseSepolia

# Test on Story Aeneid
npm run test:proxy-oft -- --network storyAeneid
```

## Key Differences from USDCKrumpOFT

| Feature | USDCKrumpOFT | OAppProxyOFT |
|---------|--------------|--------------|
| Token Type | Custom token "USDC.k" | Wraps standard USDC |
| Minting | Owner can mint | No minting (uses existing USDC) |
| Approval | Not required (is the token) | Required (wraps external token) |
| Use Case | Custom token ecosystem | Bridge existing USDC |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Base Sepolia                          │
│                                                           │
│  User's USDC ──[approve]──> OAppProxyOFT ──[lock]──>   │
│                                                           │
│                    LayerZero Endpoint                     │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │
                    Cross-Chain Message
                           │
┌──────────────────────────┼────────────────────────────────┐
│                    Story Aeneid                           │
│                           │                                │
│                    LayerZero Endpoint                     │
│                           │                                │
│  OAppProxyOFT ──[unlock]──> Wrapped USDC ──> User         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Environment Variables

Add to your `.env` file:

```bash
# Base Sepolia
BASE_SEPOLIA_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
BASE_SEPOLIA_SEND_LIB=0x... # Official LayerZero SendUln302
BASE_SEPOLIA_RECEIVE_LIB=0x... # Official LayerZero ReceiveUln302

# Story Aeneid
STORY_AENEID_ENDPOINT=0xdB09C62692B837C6bd8E53dF33957E5f018A68B4
STORY_AENEID_USDC=0x... # Wrapped USDC address
STORY_AENEID_SEND_LIB=0x... # Self-deployed SendUln302
STORY_AENEID_RECEIVE_LIB=0x... # Self-deployed ReceiveUln302

# Common
DELEGATE_ADDRESS=0x... # Your delegate/owner address
PRIVATE_KEY=0x... # Your deployer private key
```

## Important Notes

⚠️ **Only ONE OAppProxyOFT should exist per token per chain** - LayerZero's OFTAdapter pattern requires a single lockbox per token mesh.

⚠️ **Users must approve USDC** before bridging - Unlike `USDCKrumpOFT` (which IS the token), `OAppProxyOFT` wraps an external token and requires approval.

⚠️ **Story Aeneid needs wrapped USDC** - Since standard USDC doesn't exist on Story Aeneid, you need to deploy or use a wrapped USDC token first.

## Credits

**Author**: Asura aka Angel of Indian Krump  
**Website**: https://asura.lovable.app/  
**Initiative**: StreetKode Fam Initiative  
**Credits**: StreetKode Fam: Asura, Hectik, Kronos, Jo
