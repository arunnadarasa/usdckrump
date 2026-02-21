# Custom Bridge PoC (Base Sepolia → Story Aeneid)

Proof-of-concept bridge to move USDC from Base Sepolia to Story Aeneid as **USDC.d** (BridgeUSDC) for use with OpenClaw Agents on EVVM 1140.

## Flow

1. **Source (Base Sepolia):** User calls `BridgeVault.lock(amount, destinationRecipient)`. USDC is transferred to the vault; `LockRequest(sourceChainId, sender, destinationRecipient, amount, nonce)` is emitted.
2. **Relayer:** Watches `LockRequest` on Base Sepolia and calls `BridgeReceiver.fulfillLock(sourceChainId, nonce, recipient, amount)` on Story Aeneid (as the attester).
3. **Destination (Story Aeneid):** `BridgeReceiver` mints `BridgeUSDC` (USDC.d) to the recipient. Replay protection: each `(sourceChainId, nonce)` is used at most once.

## Contracts

- **BridgeVault** (source): Holds locked USDC; emits `LockRequest`. Configured with Base Sepolia USDC and chain ID.
- **BridgeUSDC** (destination): ERC20 "USDC Dance" / "USDC.d" (6 decimals). Only `BridgeReceiver` can mint. Implements **EIP-3009** (transferWithAuthorization) for x402/OpenClaw agent payments.
- **BridgeReceiver** (destination): Attester-only `fulfillLock`; mints BridgeUSDC and marks `(sourceChainId, nonce)` as used.

**Bridge EVVM Adapter** (separate deploy): EVVMPaymentAdapter wired to BridgeUSDC. Use this adapter for OpenClaw agents paying with bridged USDC.d; the existing LayerZero adapter remains for when LZ supports Story Aeneid.

## Deploy

```bash
# 1. Base Sepolia – vault
npm run deploy:bridge-vault

# 2. Story Aeneid – BridgeUSDC + BridgeReceiver (attester = deployer or set BRIDGE_ATTESTER)
npm run deploy:bridge-receiver

# 3. Story Aeneid – EVVM adapter for BridgeUSDC (x402 / OpenClaw)
npm run deploy:bridge-evvm-adapter
```

Deployment addresses: `deployments/bridge-base-sepolia-latest.json`, `deployments/bridge-story-aeneid-latest.json`, `deployments/bridge-evvm-adapter-latest.json`.

## Run relayer

The relayer must use the **attester** private key (the address set as `attester` when deploying BridgeReceiver):

```bash
BRIDGE_ATTESTER_KEY=<attester_private_key> npm run relayer:bridge
```

Or use the same key as `PRIVATE_KEY`. The relayer polls Base Sepolia for `LockRequest` and submits `fulfillLock` on Story Aeneid.

## Test lock

On Base Sepolia, with USDC balance and after approving the vault:

```bash
npm run test:bridge-lock
# Then run the relayer in another terminal to fulfill.
```

Optional env: `LOCK_AMOUNT` (default `"1"`), `LOCK_RECIPIENT` (default deployer).

## Security (PoC)

- **Trust:** One attester address; no decentralized verification.
- **Replay:** Enforced by `(sourceChainId, nonce)` used only once.
- For production or scaling, consider multisig attester, signature-based attestation, or rate limits.
