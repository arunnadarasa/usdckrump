# LayerZero Relayer for OAppProxyOFT (custom endpoint)

When you use the **self-deployed** LayerZero endpoint on Base Sepolia, messages are emitted on that endpoint only. The public LayerZero relayers do not watch your endpoint, so you must run your own **verifier** and **executor** workers to get messages to Story Aeneid.

## Flow (two workers)

1. **Verifier worker** (`lz-verifier:oapp-proxy`): watches `PacketSent` on Base, builds `packetHeader` / `payloadHash`, on Story Aeneid calls **VerifierDVN.submitVerification** then **ReceiveUln302.commitVerification** so **PacketVerified** is emitted.
2. **Executor worker** (`lz-executor:oapp-proxy`): watches **PacketVerified** on Story Aeneid, then calls **endpoint.lzReceive(...)** to mint/credit USDC.k.

Without the verifier, PacketVerified never appears and the executor has nothing to run.

## What the executor does

1. **Watches** `PacketSent` on the **custom** Base Sepolia endpoint (`base-sepolia-own-latest.json`) (to track pending packets).
2. **Waits** for `PacketVerified` on the Story Aeneid endpoint (emitted after the verifier runs).
3. **Calls** `endpoint.lzReceive(...)` on Story Aeneid to mint/credit USDC.k to the recipient.

## One-time setup: VerifierDVN on Story Aeneid

So that the verifier worker can cause **PacketVerified** to be emitted, deploy **VerifierDVN** on Story Aeneid and register it as the receive-path DVN:

```bash
npm run deploy:verifier-dvn
```

This writes `verifierDVN` into `deployments/story-aeneid-latest.json`. If ReceiveUln302 is not owned by your deployer, the script prints the `setDefaultUlnConfigs` call to run manually so that VerifierDVN is the required DVN for packets from Base Sepolia (eid 40245).

## Prerequisites

- **Verifier wallet** (LZ_VERIFIER_KEY) with native token on **Story Aeneid** for verify + commitVerification.
- **Executor wallet** (LZ_EXECUTOR_KEY) with native token (ETH on Base Sepolia, IP on Story Aeneid) for `lzReceive`.
- **RPC URLs** for both chains (e.g. in `.env`).

## Run locally

Run **both** workers (e.g. in two terminals):

```bash
# Terminal 1: verifier — watches PacketSent, submits verify + commitVerification on Story
export LZ_VERIFIER_KEY="0x..."
npm run lz-verifier:oapp-proxy
```

```bash
# Terminal 2: executor — watches PacketVerified, calls lzReceive on Story
export LZ_EXECUTOR_KEY="0x..."
npm run lz-executor:oapp-proxy
```

Each polls every 10 seconds. After you send from Base Sepolia, the verifier will submit verification and commit so **PacketVerified** is emitted; the executor will then pick it up and call **lzReceive**.

## Deploy to Fly.io (24/7)

Use the same pattern as the existing LZ executor:

1. Create app (if needed):
   ```bash
   flyctl launch --no-deploy --copy-config --name usdckrump-lz-executor-oapp --yes --config fly-lz-executor.toml
   ```

2. Set secrets:
   ```bash
   flyctl secrets set LZ_EXECUTOR_KEY="0x..." BASE_SEPOLIA_RPC="https://..."
   ```

3. Use a Dockerfile that runs the OApp Proxy worker:
   - Copy `Dockerfile.lz-executor` to e.g. `Dockerfile.lz-executor-oapp` and set:
     `CMD ["node", "scripts/lz-executor-worker-oapp-proxy.js"]`
   - Deploy with that Dockerfile so the Fly app runs the custom-endpoint worker.

## Relayers summary

| Relayer | Role | Use case |
|--------|------|----------|
| **Custom bridge** (`relayer:bridge`) | LockRequest → fulfillLock | BridgeVault / BridgeReceiver |
| **LZ verifier OApp Proxy** (`lz-verifier:oapp-proxy`) | PacketSent → verify + commitVerification → PacketVerified | Required so executor can run |
| **LZ executor OApp Proxy** (`lz-executor:oapp-proxy`) | PacketVerified → lzReceive | Custom endpoint + OAppProxyOFT (this setup) |
| **LZ executor (official)** (`lz-executor`) | PacketVerified → lzReceive | Official LZ endpoint + USDCKrumpOFT |

For custom endpoint + OAppProxyOFT, run **`lz-verifier:oapp-proxy`** and **`lz-executor:oapp-proxy`**.

## Troubleshooting

- **Verify/commit error (0x78e84d06 LZ_ULN_Verifying)**  
  If the debug script shows `verifiable() was true` but commit still reverts, it is often a **race**: the verifier worker and the debug script (or two workers) both try to commit the same packet. The first commit clears the verification storage, so the second reverts. **Stop the verifier worker** before running `node scripts/debug-verifier-hashlookup.js`, then run the script; if commit then succeeds, the issue was the race. When only the verifier worker runs, it uses a single `submitAndCommit` tx so no race.
