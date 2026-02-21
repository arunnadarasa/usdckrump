# USDC Krump (USDC.k) – LayerZero Bridge & EVVM

USDC for Krump dancers on EVVM Story: two-way bridge (USDC ↔ USDC.k) between Base Sepolia and Story Aeneid, with x402 and EVVM 1140 for OpenClaw agent payments.

## Project Structure

```
.
└── LayerZero - Story Aeneid/
    ├── lz-bridge/                    # LayerZero + custom bridge contracts and scripts
    │   ├── contracts/
    │   │   ├── bridge/               # Custom bridge (Base Sepolia ↔ Story Aeneid)
    │   │   │   ├── BridgeVault.sol   # Lock USDC on Base Sepolia
    │   │   │   ├── BridgeUSDC.sol    # USDC.k on Story Aeneid (EIP-3009)
    │   │   │   ├── BridgeReceiver.sol
    │   │   │   └── README.md
    │   │   ├── EVVMPaymentAdapter.sol    # EVVM adapter (EIP-3009 on token)
    │   │   ├── EVVMNativeX402Adapter.sol # EVVM native x402 (no EIP-3009 on token)
    │   │   ├── OAppProxyOFT.sol      # LayerZero OAppProxyOFT (USDC.k)
    │   │   └── ...
    │   ├── scripts/                  # Deploy, verify, relayer, evvm-deposit, tests
    │   ├── fly.toml                  # Fly.io config for custom bridge relayer
    │   └── Dockerfile                # Relayer image
    │
    ├── bridge-ui/                    # Web UI for bridging (Custom Bridge + LayerZero OFT)
    │   ├── src/
    │   └── package.json              # npm run dev
    │
    └── openclaw-skill-usdc-dance-evvm/ # OpenClaw skill for agent payments
        ├── SKILL.md
        ├── src/
        └── examples/                 # two-agents-x402-native.ts, etc.
```

## Features

- ✅ **Custom Bridge (two-way)**: USDC → USDC.k (lock/fulfillLock) and USDC.k → USDC (lockBack/release); relayer on Fly.io or local
- ✅ **LayerZero V2 (OAppProxyOFT)**: USDC.k on Base Sepolia & Story Aeneid with custom endpoint; verifier + executor workers
- ✅ **Bridge UI**: React app for Custom Bridge and LayerZero OFT flows (Base ↔ Story)
- ✅ **x402 Protocol**: EIP-3009-style auth; EVVM Native adapter uses Core internal balances (no token pull)
- ✅ **EVVM Integration**: EVVM Core 1140; Bridge EVVM adapter (EIP-3009) and **EVVM Native x402 adapter** (deposit via Treasury, then `Core.pay()`)
- ✅ **OpenClaw Skill**: ClawHub skill for BridgeUSDC + both adapters; two-agent native example

## Deployment Status

**✅ Contracts deployed and verified**

- **Custom bridge**: BridgeVault (Base Sepolia), BridgeUSDC (USDC.k) + BridgeReceiver (Story Aeneid)
- **EVVM adapters (Story Aeneid)**: Bridge EVVM adapter (EIP-3009 on token); **EVVM Native x402 adapter** ([verified](https://aeneid.storyscan.io/address/0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc#code))
- **LayerZero**: OAppProxyOFT, custom endpoint, VerifierDVN on Base Sepolia & Story Aeneid (see [lz-bridge README](LayerZero%20-%20Story%20Aeneid/lz-bridge/README.md))

**Credits:** Asura (Angel of Indian Krump), [asura.lovable.app](https://asura.lovable.app/), StreetKode Fam Initiative, StreetKode Fam (Asura, Hectik, Kronos, Jo).

---

## Quick Start

### 1. Custom Bridge (USDC ↔ USDC.k)

```bash
cd "LayerZero - Story Aeneid/lz-bridge"
npm install
# Deploy (set PRIVATE_KEY, BASE_SEPOLIA_RPC, STORY_AENEID_RPC)
npm run deploy:bridge-vault        # Base Sepolia
npm run deploy:bridge-receiver     # Story Aeneid
npm run deploy:bridge-evvm-adapter  # Story Aeneid (EVVM 1140)
```

**Relayer (pick one):**

- **Fly.io**: Deploy relayer to Fly; set secrets `BRIDGE_ATTESTER_KEY`, `BASE_SEPOLIA_RPC` (e.g. Alchemy). See [fly.toml](LayerZero%20-%20Story%20Aeneid/lz-bridge/fly.toml).
- **Local**: `BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge`

### 2. Bridge UI (frontend)

```bash
cd "LayerZero - Story Aeneid/bridge-ui"
npm install
npm run dev
```

Open the URL (e.g. http://localhost:5173). Use **Custom Bridge** for the lock/fulfillLock flow (relayer on Fly.io or local). Use **LayerZero OFT** when running the LZ verifier + executor workers.

### 3. LayerZero OAppProxyOFT (optional)

For USDC.k via LayerZero with a custom endpoint on Base Sepolia and Story Aeneid:

```bash
cd "LayerZero - Story Aeneid/lz-bridge"
# After deploying endpoint + OAppProxyOFT and configuring VerifierDVN:
npm run lz-verifier:oapp-proxy   # Verifier: PacketSent (Base) → commit (Story)
npm run lz-executor:oapp-proxy   # Executor: PacketVerified → lzReceive (Story)
```

Requires `BASE_SEPOLIA_RPC`, `STORY_AENEID_RPC`, `LZ_VERIFIER_KEY`, `LZ_EXECUTOR_KEY`. See [RELAYER_OAPP_PROXY.md](LayerZero%20-%20Story%20Aeneid/lz-bridge/docs/RELAYER_OAPP_PROXY.md).

### 4. EVVM Native x402 (recommended for agents)

EVVM Core moves **internal ledger balances**; the payer must deposit USDC.k into EVVM first, then x402 payments use the Native adapter.

```bash
cd "LayerZero - Story Aeneid/lz-bridge"
# Deploy native adapter (once)
npm run deploy:bridge-evvm-native-adapter
# Payer deposits USDC.k into EVVM (run with payer key)
PRIVATE_KEY=0x<payer_key> DEPOSIT_AMOUNT=1000000 npm run evvm:deposit-usdck
```

Then run the two-agent native example:

```bash
cd "LayerZero - Story Aeneid/openclaw-skill-usdc-dance-evvm"
AGENT_A_PRIVATE_KEY=0x... AGENT_B_ADDRESS=0x... npx tsx examples/two-agents-x402-native.ts
```

See [examples README](LayerZero%20-%20Story%20Aeneid/openclaw-skill-usdc-dance-evvm/examples/README-two-agents-x402.md) for direct x402 and legacy adapter flows.

### 5. Verify & Test

```bash
cd "LayerZero - Story Aeneid/lz-bridge"
npm run test:bridge       # Test bridge configuration
npm run test:bridge-lock  # Lock USDC on Base (then relayer fulfills on Story)
npm run test:x402-bridge  # x402 with BridgeUSDC → Bridge adapter
npm run test:x402-native  # x402 with EVVM Native adapter (after evvm:deposit-usdck)
```

### 6. OpenClaw Skill

```bash
cd "LayerZero - Story Aeneid/openclaw-skill-usdc-dance-evvm"
npm install
# See SKILL.md for BridgeUSDC, native adapter, and EVVM deposit
```

---

## Documentation

- [LayerZero Bridge README](LayerZero%20-%20Story%20Aeneid/lz-bridge/README.md)
- [Custom Bridge README](LayerZero%20-%20Story%20Aeneid/lz-bridge/contracts/bridge/README.md)
- [LZ Verifier/Executor (OAppProxyOFT)](LayerZero%20-%20Story%20Aeneid/lz-bridge/docs/RELAYER_OAPP_PROXY.md)
- [OpenClaw Skill](LayerZero%20-%20Story%20Aeneid/openclaw-skill-usdc-dance-evvm/SKILL.md)

## License

MIT
