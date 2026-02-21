# Setup Instructions

Follow these steps to set up the LayerZero V2 bridge project:

## Prerequisites

1. Node.js (v18 or higher)
2. npm or yarn
3. A testnet wallet with some ETH on Base Sepolia and IP on Story Aeneid
4. Git (to clone LayerZero V2)

## Step-by-Step Setup

### 1. Clone and Build LayerZero V2

```bash
cd ~
git clone https://github.com/LayerZero-Labs/layerzero-v2.git
cd layerzero-v2
yarn install
yarn build
```

### 2. Copy LayerZero Contracts

```bash
cd ~/Documents/LayerZero\ -\ Story\ Aeneid/lz-bridge
cp -r ~/layerzero-v2/packages/layerzero-v2/contracts/* contracts/
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your:
# - BASE_SEPOLIA_RPC (Alchemy or public RPC)
# - STORY_AENEID_RPC (https://aeneid.storyrpc.io)
# - PRIVATE_KEY (testnet wallet private key)
# - ETHERSCAN_API_KEY (optional)
```

### 5. Get Testnet Funds

**Base Sepolia ETH:**
- https://cloud.google.com/application/web3/faucet/ethereum/sepolia

**Base Sepolia USDC:**
- https://faucet.circle.com (select Ethereum Sepolia)

**Story Aeneid IP:**
- Check Story docs/Discord for faucet

### 6. Deploy Infrastructure

```bash
# Deploy LayerZero to Base Sepolia
npm run deploy:base

# Deploy LayerZero to Story Aeneid
npm run deploy:story

# Deploy OFT on Base Sepolia
npm run deploy:oft -- baseSepolia

# Deploy OFT on Story Aeneid
npm run deploy:oft -- storyAeneid

# Link the OFTs
npm run link:oft
```

### 7. Test

```bash
npm test
```

## Notes

- All deployment addresses are saved in `deployments/` directory
- Make sure you have enough ETH on Base Sepolia and IP on Story Aeneid for gas
- The executor needs to be funded with IP on Story Aeneid to deliver messages
- For testnet, use throwaway wallets only!

## Next Steps

After successful deployment:
1. Integrate with your Dance Verify backend
2. Listen for `PaymentReceived` events on Story Aeneid
3. Verify payments using the receiptId from events
