# USDC Krump (USDC.k) – LayerZero Bridge & EVVM

USDC for Krump dancers on EVVM Story: two-way bridge (USDC ↔ USDC.k) between Base Sepolia and Story Aeneid, with x402 (EIP-3009) and EVVM 1140 for OpenClaw agent payments.

## Project Structure

```
.
├── lz-bridge/                    # LayerZero bridge + custom bridge contracts and scripts
│   ├── contracts/
│   │   ├── USDCDanceOFT.sol      # USDC.d token with x402 (EIP-3009) support
│   │   ├── EVVMPaymentAdapter.sol # EVVM payment adapter (LayerZero or Bridge USDC.d)
│   │   ├── bridge/               # Custom bridge (Base Sepolia → Story Aeneid)
│   │   │   ├── BridgeVault.sol   # Lock USDC on source chain
│   │   │   ├── BridgeUSDC.sol    # USDC.k on Story Aeneid (EIP-3009)
│   │   │   ├── BridgeReceiver.sol
│   │   │   └── README.md
│   │   └── interfaces/
│   ├── scripts/                  # Deploy, verify, relayer, tests
│   └── test/
│
└── openclaw-skill-usdc-dance-evvm/ # OpenClaw skill for agent payments
    ├── SKILL.md                   # Skill documentation (BridgeUSDC + Bridge adapter)
    ├── src/
    └── examples/
```

## Features

- ✅ **Custom Bridge (two-way)**: USDC → USDC.k (lock/fulfillLock) and USDC.k → USDC (lockBack/release); relayer handles both directions
- ✅ **LayerZero V2**: USDCKrumpOFT (USDC.k) on Base Sepolia & Story Aeneid for future LZ support
- ✅ **x402 Protocol**: EIP-3009 `transferWithAuthorization` support
- ✅ **EVVM Integration**: EVVM Core `0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b`, EVVM ID 1140; Bridge EVVM adapter for BridgeUSDC (USDC.k)
- ✅ **Privy Integration**: Secure wallet management for OpenClaw agents
- ✅ **OpenClaw Skill**: Ready-to-use skill for ClawHub (BridgeUSDC + Bridge adapter addresses)

## 🎉 Deployment Status

**✅ All contracts deployed and verified!**

See [DEPLOYMENT.md](lz-bridge/DEPLOYMENT.md) for deployment details. See [Custom Bridge README](lz-bridge/contracts/bridge/README.md) for the bridge flow.

**Deployed Contracts:**
- ✅ LayerZero V2 Infrastructure on Story Aeneid
- ✅ USDCKrumpOFT (USDC.k) on Base Sepolia & Story Aeneid (optional, for future LZ)
- ✅ **Custom bridge**: BridgeVault (Base Sepolia, with release), BridgeUSDC (USDC.k) + BridgeReceiver (Story Aeneid), Bridge EVVM adapter (Story Aeneid, EVVM 1140)
- ✅ All contracts verified (10 gwei Story Aeneid, dynamic gas Base Sepolia)

**Credits:** Asura (Angel of Indian Krump), [asura.lovable.app](https://asura.lovable.app/), StreetKode Fam Initiative, StreetKode Fam (Asura, Hectik, Kronos, Jo).

**OpenClaw (testnet):** Use BridgeUSDC (USDC.k) and Bridge EVVM adapter; see [OpenClaw Skill](openclaw-skill-usdc-dance-evvm/SKILL.md).

## Quick Start

### 1. Deploy Contracts (LayerZero path)

```bash
cd lz-bridge
npm install
npm run deploy:base      # Deploy to Base Sepolia
npm run deploy:story     # Deploy to Story Aeneid
npm run deploy:oft -- baseSepolia
npm run deploy:oft -- storyAeneid
npm run link:oft
npm run deploy:evvm-adapter
```

### 2. Custom Bridge (USDC ↔ USDC.k, two-way)

```bash
cd lz-bridge
# Set BRIDGE_ATTESTER (or uses deployer); same address used as attester on both chains
npm run deploy:bridge-vault        # Base Sepolia (Vault + attester)
npm run deploy:bridge-receiver     # Story Aeneid (BridgeUSDC USDC.k + BridgeReceiver)
npm run deploy:bridge-evvm-adapter # Story Aeneid (EVVM 1140)
# Run relayer (both directions): BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge
```

Optional – USDC.k LayerZero OFT (future support):

```bash
npm run deploy:oft-krump -- baseSepolia
npm run deploy:oft-krump -- storyAeneid
npm run link:oft-krump
```

### 3. Verify & Test

```bash
npm run test:bridge       # Test bridge configuration
npm run test:bridge-lock  # Lock USDC on Base Sepolia (then run relayer)
npm run test:x402-bridge  # x402 payment with BridgeUSDC → Bridge adapter
npm run verify:contracts # Verify contracts on StoryScan
```

### 4. Install OpenClaw Skill

```bash
clawhub install usdc-dance-evvm-payment
```

Or clone and use locally:

```bash
cd openclaw-skill-usdc-dance-evvm
npm install
```

## Documentation

- [LayerZero Bridge README](lz-bridge/README.md)
- [Custom Bridge README](lz-bridge/contracts/bridge/README.md)
- [OpenClaw Skill Documentation](openclaw-skill-usdc-dance-evvm/SKILL.md)

## License

MIT
