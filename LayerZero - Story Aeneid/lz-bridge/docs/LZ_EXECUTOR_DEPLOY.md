# Deploy LayerZero Executor Worker to Fly.io

This guide walks through deploying the **LayerZero Executor Worker** for USDCKrumpOFT messages to [Fly.io](https://fly.io) so it runs 24/7.

**Note:** This is separate from the custom bridge relayer. This worker handles LayerZero V2 OFT messages, while the bridge relayer handles custom `LockRequest` events.

---

## Prerequisites

- **Fly CLI** – [Install](https://fly.io/docs/hub/cli/) (e.g. `brew install flyctl` on macOS).
- **Executor private key** – Wallet that will execute `lzReceive` calls (can be same as bridge attester or separate).
- **Executor funded on both chains** – Needs native token on Base Sepolia and Story Aeneid to pay gas for executions.
- **RPC URLs** – Base Sepolia and Story Aeneid RPC endpoints.

---

## One-time Setup

### 1. Log in to Fly

```bash
flyctl auth login
```

### 2. Create the app (first time only)

From the **`lz-bridge`** directory:

```bash
cd lz-bridge
flyctl launch --no-deploy --copy-config --name usdckrump-lz-executor --yes --config fly-lz-executor.toml
```

If the app already exists, skip to step 3.

### 3. Set secrets

```bash
flyctl secrets set LZ_EXECUTOR_KEY="<your_executor_private_key_hex>" BASE_SEPOLIA_RPC="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
```

Optional (script has defaults):

```bash
flyctl secrets set STORY_AENEID_RPC="https://aeneid.storyrpc.io"
```

### 4. Deploy

```bash
flyctl deploy -c fly-lz-executor.toml
```

---

## After deploy

| Action | Command |
|--------|---------|
| View logs | `flyctl logs -a usdckrump-lz-executor` |
| Restart | `flyctl apps restart usdckrump-lz-executor` |
| SSH | `flyctl ssh console -a usdckrump-lz-executor` |
| Dashboard | https://fly.io/apps/usdckrump-lz-executor |

---

## How it works

1. **Watches PacketSent events** from USDCKrumpOFT on both chains
2. **Stores pending packets** (decodes packet to get origin, receiver, guid, message)
3. **Waits for PacketVerified** (DVNs have verified the message)
4. **Executes lzReceive** on destination chain when verifiable
5. **Tracks processed messages** to avoid duplicates

---

## Two Workers Summary

| Worker | Handles | App Name | Config |
|--------|---------|----------|--------|
| **Custom Bridge Relayer** | `LockRequest` → `fulfillLock`<br>`LockRequestBack` → `release` | `usdckrump-relayer` | `fly.toml` |
| **LayerZero Executor** | `PacketSent` → `lzReceive` (OFT messages) | `usdckrump-lz-executor` | `fly-lz-executor.toml` |

Both can run simultaneously for complete bridge coverage.
