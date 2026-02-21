# Deploy Bridge Relayer to Fly.io

This guide walks through deploying the **USDC Dance bridge relayer** to [Fly.io](https://fly.io) so it runs 24/7. The relayer watches for `LockRequest` events on Base Sepolia and calls `fulfillLock` on Story Aeneid, minting USDC.d to the recipient.

---

## Prerequisites

- **Fly CLI** – [Install](https://fly.io/docs/hub/cli/) (e.g. `brew install flyctl` on macOS).
- **Attester private key** – The wallet address set as `attester` when `BridgeReceiver` was deployed (see `deployments/bridge-story-aeneid-latest.json`). You need the **private key** for this address.
- **Attester funded on Story Aeneid** – The attester pays gas for `fulfillLock` on chain 1315. Ensure that wallet has native token on Story Aeneid.
- **Base Sepolia RPC** – A working RPC URL (e.g. [Alchemy](https://alchemy.com) Base Sepolia). Optional if you rely on the script default.

---

## One-time setup

### 1. Log in to Fly

```bash
flyctl auth login
```

This opens a browser to authenticate with Fly.io.

### 2. Create the app (first time only)

From the **`lz-bridge`** directory (where `Dockerfile` and `fly.toml` live):

```bash
cd lz-bridge
flyctl launch --no-deploy --copy-config --name usdc-dance-relayer --yes
```

- `--no-deploy` – Creates the app and config without deploying yet (so you can set secrets first).
- `--copy-config` – Uses the existing `fly.toml`.
- `--name usdc-dance-relayer` – App name (optional; omit to let Fly generate one).
- `--yes` – Skip interactive prompts where possible.

If the app **already exists** (e.g. you’ve run this before), skip to step 3.

### 3. Set secrets

**Do not commit private keys or RPC URLs.** Set them on Fly:

```bash
flyctl secrets set BRIDGE_ATTESTER_KEY="<your_attester_private_key_hex>"
flyctl secrets set BASE_SEPOLIA_RPC="https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"
```

Optional (script has defaults):

```bash
flyctl secrets set STORY_AENEID_RPC="https://aeneid.storyrpc.io"
```

You can set multiple in one go:

```bash
flyctl secrets set BRIDGE_ATTESTER_KEY="0x..." BASE_SEPOLIA_RPC="https://..."
```

### 4. Deploy

```bash
flyctl deploy
```

This builds the image (using `Dockerfile` and `npm ci --legacy-peer-deps`) and deploys the relayer. The process runs `node scripts/relayer-bridge.js` and polls every 15 seconds.

---

## After deploy

| Action | Command |
|--------|--------|
| View live logs | `flyctl logs` |
| Restart the app | `flyctl apps restart usdc-dance-relayer` |
| SSH into the machine | `flyctl ssh console` |
| Open dashboard | [fly.io/apps/usdc-dance-relayer](https://fly.io/apps/usdc-dance-relayer) |

The relayer has no HTTP API; it only runs the Node script. Success in logs looks like:

```
🔁 Bridge relayer (PoC)
   Attester: 0x...
   Vault (Base Sepolia): 0x...
   Receiver (Story Aeneid): 0x...
   Poll interval: 15 s

   Listening for LockRequest...
   Fulfilled nonce 3 → 0x... 1.0 USDC.d tx=0x...
```

---

## How to try it

1. Run the **bridge UI** (e.g. `cd bridge-ui && npm run dev` → http://localhost:5173).
2. Connect your wallet, switch to **Base Sepolia**, enter an amount and click **Bridge**.
3. After the lock tx confirms, the Fly relayer will pick up the event (within ~15 s) and call `fulfillLock` on Story Aeneid.
4. Check your wallet on **Story Aeneid** (chain 1315) for **USDC.d**; also check `flyctl logs` for “Fulfilled nonce …”.

---

## Troubleshooting

- **Machines restarting / exit code 1** – Check logs for missing env (e.g. `BRIDGE_ATTESTER_KEY`) or RPC errors. Ensure secrets are set and the attester has gas on Story Aeneid.
- **“Fulfill failed for nonce N” / transaction reverted** – Often means that nonce was already fulfilled (e.g. duplicate event or two relayer instances). The recipient should already have received USDC.d from the first successful tx.
- **Build fails (e.g. npm ERESOLVE)** – The Dockerfile uses `npm ci --legacy-peer-deps`; if you change deps, ensure the image still builds.
- **Relayer uses ethers only** – The script does not load Hardhat, so no Hardhat plugins (e.g. chai) are required in the container.

---

## Files in this repo

| File | Purpose |
|------|--------|
| `lz-bridge/Dockerfile` | Node image, `npm ci --legacy-peer-deps`, runs `scripts/relayer-bridge.js`. |
| `lz-bridge/fly.toml` | App name, build config, non-secret env (e.g. `STORY_AENEID_RPC`). |
| `lz-bridge/scripts/relayer-bridge.js` | Relayer script (ethers only, no Hardhat). |
| `lz-bridge/deployments/bridge-*.json` | Contract addresses; must be present in the image. |

Secrets (attester key, RPC URLs) are **not** in the repo; they are set via `flyctl secrets set`.
