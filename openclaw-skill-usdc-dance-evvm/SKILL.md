---
name: usdc-dance-evvm-payment
description: Pay with USDC Krump (USDC.k) via x402 on Story Aeneid EVVM. Supports EVVM Native adapter (no EIP-3009 on token) and legacy Bridge adapter. Privy or private key.
version: 1.2.0
author: OpenClaw USDC Krump
tags: [payment, evvm, x402, usdc, layerzero, story-aeneid, openclaw, privy, bridge, usdc-krump]
requires: [privy]
---

# USDC Krump (USDC.k) EVVM Payment Skill

Enables OpenClaw agents to pay with **USDC Krump (USDC.k)** via the **x402 protocol** on **Story Aeneid EVVM**, using **Privy server wallets** or a private key.

## Features

- ✅ **Privy Integration**: Privy server wallets for autonomous agent transactions
- ✅ **x402 Protocol**: EIP-3009-style auth; **EVVM Native adapter** (Core internal balances) or legacy adapter (EIP-3009 on token)
- ✅ **EVVM Integration**: Payment routing through EVVM Core (ID 1140)
- ✅ **EVVM Deposit**: Script to deposit USDC.k into EVVM Treasury so payers have internal balance for Native adapter
- ✅ **Two-Agent Examples**: Direct x402, legacy adapter, and **native adapter** (`two-agents-x402-native.ts`)
- ✅ **Policy-Based Security**: Privy policies for spending limits and guardrails
- ✅ **Receipt Tracking**: `checkPaymentStatus(receiptId, adapterAddress, rpcUrl)`

## Prerequisites

1. **Privy Account**: Get credentials from [dashboard.privy.io](https://dashboard.privy.io)
2. **Privy Skill Installed**: `clawhub install privy`
3. **OpenClaw Config**: Add Privy credentials to `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "vars": {
      "PRIVY_APP_ID": "your-app-id",
      "PRIVY_APP_SECRET": "your-app-secret"
    }
  }
}
```

## Quick Start

### EVVM deposit before using Native adapter

EVVM Core moves **internal ledger balances**; it does not pull tokens from the wallet. For the **EVVM Native x402 adapter**, the payer must deposit USDC.k into EVVM first (in `lz-bridge`):

```bash
cd lz-bridge
PRIVATE_KEY=0x<payer_key> DEPOSIT_AMOUNT=1000000 npm run evvm:deposit-usdck
```

Then use `useNativeAdapter: true` and the Native adapter address below.

### Option 1: Using Privy Wallet (Recommended)

```typescript
import { payViaEVVMWithPrivy } from './src/index';

// EVVM Native adapter (no EIP-3009 on token; payer must have deposited USDC.k via Treasury)
const receipt = await payViaEVVMWithPrivy({
  walletId: 'privy-wallet-id',
  to: recipientAddress,
  amount: '1000000', // 1 USDC.k (6 decimals)
  receiptId: 'payment_123',
  adapterAddress: '0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc', // EVVM Native x402 adapter
  usdcDanceAddress: '0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5', // USDC.k (BridgeUSDC)
  evvmCoreAddress: '0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b',
  evvmId: 1140,
  rpcUrl: 'https://aeneid.storyrpc.io',
  useNativeAdapter: true,
});
```

### Option 2: Using Private Key (Legacy)

```typescript
import { payViaEVVM } from './src/index';

const receipt = await payViaEVVM({
  from: agentAddress,
  to: recipientAddress,
  amount: '1000000',
  receiptId: 'payment_123',
  privateKey: agentPrivateKey,
  adapterAddress: '0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc', // Native adapter
  usdcDanceAddress: '0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5',
  evvmCoreAddress: '0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b',
  evvmId: 1140,
  rpcUrl: 'https://aeneid.storyrpc.io',
  useNativeAdapter: true,
});
```

### Two-agent native example

```bash
AGENT_A_PRIVATE_KEY=0x... AGENT_B_ADDRESS=0x... npx tsx examples/two-agents-x402-native.ts
```

See `examples/README-two-agents-x402.md` for direct x402 and legacy adapter flows.

## Configuration

### Required Addresses (Story Aeneid Testnet)

- **EVVM Core**: `0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b`
- **EVVM ID**: `1140`
- **USDC.k (BridgeUSDC)**: `0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5`
- **EVVM Native x402 adapter**: `0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc` — use with `useNativeAdapter: true` (payer must deposit USDC.k via Treasury first)
- **Bridge EVVM adapter (legacy)**: `0x00ed0E80E5EAE285d98eC50236aE97e2AF615314` — EIP-3009 on token

### Network Details

- **Chain**: Story Aeneid Testnet
- **Chain ID**: `1315`
- **Native Currency**: IP
- **RPC**: `https://aeneid.storyrpc.io`

## Privy Integration

This skill integrates with the [Privy OpenClaw skill](https://docs.privy.io/recipes/agent-integrations/openclaw-agentic-wallets) to enable:

- **Autonomous Wallet Management**: Agents have their own Privy server wallets
- **Policy-Based Security**: Use Privy policies to limit spending, restrict chains, or whitelist contracts
- **No Private Key Storage**: Privy handles key management securely
- **Transaction Signing**: Privy signs EIP-3009 and EIP-191 signatures via API

### Creating a Privy Wallet for Your Agent

Ask your OpenClaw agent:

> "Create an Ethereum wallet for yourself using Privy on Story Aeneid testnet"

The agent will create a Privy server wallet and return the wallet ID.

### Setting Up Policies

Create spending limits and restrictions:

> "Create a Privy policy that limits USDC Krump (USDC.k) payments to 10 USDC.k max per transaction"

> "Attach the spending limit policy to my Privy wallet"

## Functions

### `payViaEVVMWithPrivy(options)`

Process a payment through EVVM using x402 protocol with Privy wallet.

**Parameters:**
- `walletId`, `to`, `toIdentity`, `amount`, `receiptId`, `adapterAddress`, `usdcDanceAddress`, `evvmCoreAddress`, `evvmId`, `rpcUrl` (see Option 1 example)
- `useNativeAdapter`: Set `true` for EVVM Native x402 adapter (payer must have deposited USDC.k via Treasury first)
- `privyAppId`, `privyAppSecret`: Optional; use env vars if not provided

**Returns:** Transaction receipt

### `payViaEVVM(options)` (Legacy)

Process payment using private key directly (not recommended for production).

### `checkPaymentStatus(receiptId, adapterAddress, rpcUrl)`

Check if a payment was successfully processed.

## Examples

See `examples/` directory for:
- `two-agents-x402-native.ts` - Two agents with EVVM Native adapter (recommended)
- `two-agents-x402-simulation.ts` - Two agents with legacy Bridge adapter
- `two-agents-x402-direct.ts` - Direct x402 transfer (no EVVM)
- `agent-payment-privy-example.ts` - Privy wallets
- `agent-payment-example.ts` - Private keys (legacy)

See `examples/README-two-agents-x402.md` for EVVM deposit step and all flows.

## Security Considerations

⚠️ **Important**: When using Privy wallets:

1. **Set Policies**: Always configure spending limits and restrictions
2. **Test First**: Test on testnet before using real funds
3. **Monitor Activity**: Regularly check wallet activity in Privy dashboard
4. **Rotate Credentials**: If compromised, rotate Privy App Secret immediately

## Requirements

- Node.js 18+
- ethers.js v6
- Privy skill installed (`clawhub install privy`)
- Access to Story Aeneid RPC endpoint
- Privy account with App ID and App Secret

## License

MIT
