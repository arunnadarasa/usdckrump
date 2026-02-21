# LayerZero V2 on Story Aeneid Testnet
## Complete Setup Guide

**Goal**: Deploy LayerZero V2 cross-chain bridge from Base Sepolia → Story Aeneid (chain ID 1315) for Dance Verify payments with x402 (EIP-3009) compliance.

**Token**: USDC Dance (USDC.d) - ERC-20 token with LayerZero cross-chain and x402 payment protocol support

**Time estimate**: 2-3 hours first time

---

## 📋 Quick Start (TL;DR)

```bash
# 1. Clone LayerZero and build
git clone https://github.com/LayerZero-Labs/layerzero-v2.git
cd layerzero-v2
yarn install
yarn build

# 2. Copy contracts to your project
cp -r packages/layerzero-v2/contracts/* ~/Documents/LayerZero\ -\ Story\ Aeneid/lz-bridge/contracts/

# 3. Install dependencies
cd ~/Documents/LayerZero\ -\ Story\ Aeneid/lz-bridge
npm install

# 4. Set up .env file (copy from .env.example and fill in your values)
cp .env.example .env

# 5. Get testnet funds (Base Sepolia + Story Aeneid)

# 6. Deploy to Base Sepolia
npm run deploy:base

# 7. Deploy to Story Aeneid
npm run deploy:story

# 8. Deploy USDC Dance OFT on both chains
npm run deploy:oft -- baseSepolia
npm run deploy:oft -- storyAeneid

# 9. Link OFTs
npm run link:oft

# 10. Test!
npm test
```

---

## 🌐 Deploy Workers to Fly.io (24/7)

### Custom Bridge Relayer
The **custom bridge** (BridgeVault ↔ BridgeReceiver) uses a relayer that watches for `LockRequest`/`LockRequestBack` and calls `fulfillLock`/`release`. 

- **Guide:** [docs/FLY_DEPLOY.md](docs/FLY_DEPLOY.md)
- **App:** `usdckrump-relayer` (fly.toml)
- **Quick steps:** `flyctl launch --no-deploy --copy-config --name usdckrump-relayer --yes` → set `BRIDGE_ATTESTER_KEY` → `flyctl deploy`

### LayerZero Executor Worker
The **LayerZero executor** handles USDCKrumpOFT OFT messages via LayerZero V2, executing `lzReceive` after DVN verification.

- **Guide:** [docs/LZ_EXECUTOR_DEPLOY.md](docs/LZ_EXECUTOR_DEPLOY.md)
- **App:** `usdckrump-lz-executor` (fly-lz-executor.toml)
- **Quick steps:** `flyctl launch --no-deploy --copy-config --name usdckrump-lz-executor --yes --config fly-lz-executor.toml` → set `LZ_EXECUTOR_KEY` → `flyctl deploy -c fly-lz-executor.toml`

### LayerZero Executor for OAppProxyOFT (custom endpoint)
When using the **self-deployed** endpoint on Base Sepolia with **OAppProxyOFT**, run this worker so messages are delivered to Story Aeneid:

- **Guide:** [docs/RELAYER_OAPP_PROXY.md](docs/RELAYER_OAPP_PROXY.md)
- **Run locally:** `LZ_EXECUTOR_KEY=0x... npm run lz-executor:oapp-proxy`
- **Script:** `scripts/lz-executor-worker-oapp-proxy.js` (watches custom endpoint, executes `lzReceive` on Story Aeneid)

**Both workers can run simultaneously** for complete bridge coverage (custom bridge + LayerZero OFT).

---

## 📂 Project Structure

```
lz-bridge/
├── contracts/
│   ├── USDCDanceOFT.sol              # USDC Dance token (x402 compliant, EIP-3009)
│   ├── DanceVerifyOFT.sol            # Legacy contract (deprecated)
│   └── (LayerZero contracts copied from layerzero-v2/)
├── scripts/
│   ├── deploy-base.js
│   ├── deploy-story.js
│   ├── deploy-oft.js
│   └── link-oft.js
├── test/
│   └── cross-chain.test.js
├── deployments/                     # Deployment addresses saved here
├── .env                            # Your environment variables (not in git)
├── .env.example                    # Template for .env
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 🛠️ Step 1: Prepare Base Sepolia

### 1.1 Get Base Sepolia ETH
- Go to: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- Paste your wallet address
- Request 0.5 ETH
- Wait ~1 minute

### 1.2 Get Base Sepolia USDC
- Go to: https://faucet.circle.com
- Connect wallet
- Select **Ethereum Sepolia** (this is Base Sepolia's USDC)
- Request 10 USDC
- Wait ~30 seconds

### 1.3 Get Alchemy RPC Key (optional but recommended)
- Go to: https://alchemy.com
- Create account
- Create app on Base Sepolia
- Copy API key → you'll use in RPC URL

---

## 🛠️ Step 2: Prepare Story Aeneid

### 2.1 Get Story Aeneid IP (for gas)
- Faucet: Check Story docs or Discord for testnet faucet
- If no faucet, you might need to bridge some IP from another chain
- For now, assume ~0.1 IP is enough

### 2.2 Add Story Aeneid to MetaMask
```javascript
// Click MetaMask → Add Network → Manual
Network Name: Story Aeneid
New RPC URL: https://aeneid.storyrpc.io
Chain ID: 1315
Currency Symbol: IP
Block Explorer: https://aeneid.storyscan.io
```

---

## 📦 Step 3: Copy LayerZero Contracts

After cloning and building LayerZero V2 (see Quick Start), copy the contracts:

```bash
cp -r ~/layerzero-v2/packages/layerzero-v2/contracts/* contracts/
```

You should now have these contracts in `contracts/`:
- `EndpointV2.sol`
- `SendUln302.sol`
- `ReceiveUln302.sol`
- `Executor.sol`
- `OFTv2.sol`
- `OApp.sol`
- `MessageLibs/` etc.

---

## ⚙️ Step 4: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in:
   - `BASE_SEPOLIA_RPC` - Your Alchemy or public RPC URL
   - `STORY_AENEID_RPC` - https://aeneid.storyrpc.io
   - `PRIVATE_KEY` - Your testnet wallet private key (TESTNET ONLY!)
   - `ETHERSCAN_API_KEY` - Optional, for contract verification

---

## 🚀 Step 5: Deploy LayerZero Infrastructure

### Deploy to Base Sepolia:
```bash
npm run deploy:base
```

This will deploy:
- EndpointV2
- SendUln302
- ReceiveUln302
- Executor

And save addresses to `deployments/base-sepolia-latest.json`

### Deploy to Story Aeneid:
```bash
npm run deploy:story
```

This will deploy the same contracts on Story Aeneid and save to `deployments/story-aeneid-latest.json`

---

## 💰 Step 6: Deploy USDC Dance OFT

The `USDCDanceOFT` contract deploys **USDC Dance** token (symbol: **USDC.d**) with:
- ✅ LayerZero cross-chain capabilities
- ✅ x402 protocol compliance (EIP-3009 `transferWithAuthorization`)
- ✅ Payment tracking with `getPaymentInfo()`

### Deploy on Base Sepolia:
```bash
npm run deploy:oft -- baseSepolia
```

### Deploy on Story Aeneid:
```bash
npm run deploy:oft -- storyAeneid
```

After deployment, you'll have:
- **Token Name**: "USDC Dance"
- **Token Symbol**: "USDC.d"
- **Decimals**: 6 (USDC standard)

---

## 🔗 Step 7: Link the OFT Pair

```bash
npm run link:oft
```

This configures both OFTs to trust each other for cross-chain transfers.

---

## 🧪 Step 8: Test

```bash
npm test
```

This will run the cross-chain test suite, including tests for:
- Token name and symbol verification
- EIP-3009 x402 compliance
- Cross-chain transfers
- Payment tracking

---

## 🔍 Verification

### Check deployments on explorers:

**Base Sepolia**:
- BaseScan: https://base-sepolia.blockscout.com
- Search your deployed addresses

**Story Aeneid**:
- StoryScan: https://aeneid.storyscan.io
- Search your deployed addresses

---

## 🔐 x402 Protocol Support

The `USDCDanceOFT` contract implements **EIP-3009** (`transferWithAuthorization`) for x402 protocol compatibility. This allows:

- **Off-chain authorization**: Users can sign payment authorizations without broadcasting transactions
- **Gasless payments**: Facilitators can execute payments on behalf of users
- **HTTP 402 integration**: Compatible with x402 payment middleware

### Key Functions:
- `transferWithAuthorization()` - Execute signed payment authorization
- `getDomainSeparator()` - Get EIP-712 domain separator for signing
- `isNonceUsed()` - Check if a payment nonce has been used

---

## 🐛 Troubleshooting

### "Insufficient funds for gas"
- Top up your wallet on Story Aeneid (need IP for gas)
- Executor also needs IP to deliver messages

### "Invalid chain ID" in setMessagingLibrary
- Double-check: Base Sepolia is `84532`, Story Aeneid is `1315`

### "DVN verification failed"
- For testnet using MinimumDVN, ensure DVN is registered with endpoint
- Check `endpoint.getDvns()` to see registered DVNs

### "Message not delivered after 5 minutes"
- Check executor is running (if you're using one)
- Check DVN is validating messages
- Check Base tx confirmed with enough blocks

### OFT transfers revert with "Invalid remote"
- Ensure `setTrustedRemote` was called on BOTH chains
- Check you're using the correct counterpart OFT address
- Check chain IDs match (84532 ↔ 1315)

### "Authorization already used" (x402)
- Each payment authorization can only be used once
- Generate a new nonce for each payment

---

## 📞 Get Help

- **LayerZero Docs**: https://docs.layerzero.network/v2
- **LayerZero Discord**: #dev-general
- **x402 Protocol**: https://github.com/coinbase/x402
- **Story Discord**: Check Story docs for community
- **Hardhat**: https://hardhat.org/docs

---

## ✅ Success Checklist

Before declaring victory:

- [ ] LayerZero contracts deployed on Base Sepolia (4 contracts)
- [ ] LayerZero contracts deployed on Story Aeneid (4 contracts)
- [ ] Endpoints configured for each other (`setMessagingLibrary`)
- [ ] Executor registered on Story Aeneid
- [ ] USDCDanceOFT deployed on both chains
- [ ] Token name is "USDC Dance" and symbol is "USDC.d"
- [ ] EIP-3009 `transferWithAuthorization` function works
- [ ] OFTs linked via `setTrustedRemote` on both sides
- [ ] Test transfer of 0.001 USDC.d succeeds from Base → Story
- [ ] `PaymentReceived` event fires on Story OFT
- [ ] `getPaymentInfo()` returns correct payment data
- [ ] Backend can verify payment via event parsing or `getPaymentInfo()`

---

## 🎉 You're Ready!

This guide provides everything needed to get LayerZero V2 running on Story Aeneid testnet with x402-compliant payments.

**Total estimated time**: 2-3 hours for first successful transfer.

**Next after testnet**: Deploy to Story Mainnet (same process, just change network config and use mainnet RPCs).

Good luck! 🚀
