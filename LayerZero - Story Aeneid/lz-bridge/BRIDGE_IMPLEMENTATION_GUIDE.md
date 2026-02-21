# Step-by-Step Guide: Dual-Bridge Implementation (Custom Bridge + LayerZero), Verification, and Best Practices

A single reference for implementing two cross-chain bridges (Custom Bridge and LayerZero OAppProxyOFT), verifying contracts on both testnets, gas and timing, mainnet considerations, token naming, contract credits, and Cursor/GitHub workflow. Use this in Lovable or any doc tool to generate a user-facing guide.

---

## Part 1: Two-Bridge Architecture Overview

### Bridge 1: Custom Bridge (Lock / Fulfill)

- **Flow:** User locks USDC on **Base Sepolia** in `BridgeVault` → relayer watches `LockRequest` → relayer calls `BridgeReceiver.fulfillLock` on **Story Aeneid** → **USDC.k** (BridgeUSDC) is minted to the recipient.
- **Trust model:** Single attester key; relayer must be run by you (local or Fly.io).
- **Use case:** Simple two-way USDC ↔ USDC.k when you control the relayer and don’t need LayerZero’s infrastructure.

### Bridge 2: LayerZero OAppProxyOFT

- **Flow:** User sends via OAppProxyOFT on Base Sepolia (custom endpoint) → **Verifier** worker commits payload hash on Story → **Executor** worker calls `endpoint.lzReceive` to credit USDC.k.
- **Trust model:** Your custom endpoint + your VerifierDVN + your executor; no public LZ relayer.
- **Use case:** When you want LayerZero semantics (nonces, payload hash verification) and are okay running verifier + executor 24/7 (e.g. Fly.io).

**Important:** Both bridges can coexist. The **same** destination token can be branded as **USDC.k (Krump USDC)** whether it comes from the custom bridge (BridgeUSDC) or from LayerZero (OAppProxyOFT). Prefer a single canonical name/symbol (e.g. **USDC.k**) and document which bridge(s) feed it.

---

## Part 2: Implementation Steps (Custom Bridge)

### 2.1 Deploy order

1. **Base Sepolia – BridgeVault**
   - Deploy vault; set USDC address and attester.
   - Save to `deployments/bridge-base-sepolia-latest.json`.

2. **Story Aeneid – BridgeUSDC + BridgeReceiver**
   - Deploy ERC20 (BridgeUSDC) and BridgeReceiver; set attester (same as vault).
   - **Naming:** Use name/symbol like **"USDC Krump"** / **"USDC.k"** in the contract so explorers and users see Krump USDC, not generic "WrappedUSDC" or "BridgeUSDC" in the UI.

3. **Story Aeneid – Bridge EVVM adapter** (if using OpenClaw / x402)
   - Point adapter to BridgeUSDC and EVVM Core/ID.

### 2.2 Relayer

- **Local:** `BRIDGE_ATTESTER_KEY=<key> npm run relayer:bridge`
- **Fly.io:** Deploy same script; set secrets `BRIDGE_ATTESTER_KEY` and `BASE_SEPOLIA_RPC` (and optionally `STORY_AENEID_RPC`). Set **one secret per variable** to avoid concatenated env (e.g. key + RPC in one string causing "invalid BytesLike" when creating the wallet). Defensive: in code, strip the private key to the first `0x` + 64 hex chars if the env is ever mis-set.

### 2.3 What to avoid (Custom Bridge)

- Do not use the same env string for multiple secrets (e.g. pasting a whole `.env` block into one Fly secret).
- Do not skip replay protection: `(sourceChainId, nonce)` must be used at most once.
- Do not forget to fund the attester wallet with gas on **both** chains.

---

## Part 3: Implementation Steps (LayerZero OAppProxyOFT)

### 3.1 Deploy order

1. Deploy **endpoint + SendUln302 + ReceiveUln302** on Base Sepolia and Story Aeneid (or use official on Base and custom on Story).
2. Deploy **OAppProxyOFT** on both chains; point to the correct endpoint and wrapped token.
3. Deploy **VerifierDVN** on Story Aeneid; register it as the required DVN for the path from Base Sepolia (EID 40245).
4. Configure **ReceiveUln302** so that VerifierDVN is the required DVN for that path.

### 3.2 Workers

- **Verifier:** Watches `PacketSent` on Base (custom endpoint); builds packetHeader/payloadHash; calls VerifierDVN `submitAndCommit` on Story. Needs gas on **Story Aeneid** only.
- **Executor:** Watches `PacketVerified` on Story; calls `endpoint.lzReceive`. Needs gas on **Story Aeneid** (and RPC to Base for reading).

Run both when using the custom endpoint; public LayerZero relayers do not watch your endpoint.

### 3.3 RPC and rate limits

- **Base Sepolia:** Use HTTP for Hardhat/scripts (e.g. `BASE_SEPOLIA_RPC`). Use WSS for long-lived workers only if you have a separate var (e.g. `BASE_SEPOLIA_WS_RPC`); Hardhat does not accept `wss://`.
- **Rate limits:** Verifier/executor do many `eth_getLogs` calls. Use chunked block ranges (e.g. 50–150 blocks), delay between chunks (e.g. 300–600 ms), and retry with backoff on 429. If the RPC returns "compute units" or "upgrade tier," consider a higher-tier RPC (e.g. Alchemy paid) or lower request rate.

### 3.4 Double-execute and “transfer amount exceeds balance”

- If the executor runs `lzReceive` for the same nonce twice, the first tx succeeds and the second reverts with **ERC20: transfer amount exceeds balance**. Fix: before each static call and before sending the real tx, re-read the endpoint’s `inboundNonce`; if the packet’s nonce is already less than the expected next nonce, skip (mark processed and do not send tx). Apply this in all code paths (proactive execute, catch-up execute, poll execute).

### 3.5 What to avoid (LayerZero)

- Do not assume the verifier has committed before the executor tries; use retries (e.g. 2–3 attempts with 2–3 s delay) and softer logs (“Waiting for verifier to commit…”) before “Restart verifier.”
- Do not use a single RPC URL for both Hardhat and workers if it’s `wss://`; Hardhat requires `http://` or `https://`.
- Do not ignore LZ_InvalidNonce: it means the payload hash is not committed yet; wait and retry or skip once nonce is already delivered.

---

## Part 4: Verifying Smart Contracts on Both Chain Testnets

### 4.1 Base Sepolia (BaseScan)

- **Explorer:** https://sepolia.basescan.org  
- **API:** Etherscan-compatible; you need an **API key** (e.g. from Etherscan/BaseScan). Set `ETHERSCAN_API_KEY` or `BASESCAN_API_KEY` in `.env`.
- **Hardhat:** Use `npx hardhat verify --network baseSepolia <address> <constructor args...>` or a script that calls the verify task. For complex constructor args, use "Standard JSON Input" and the same compiler settings as deploy (e.g. Solidity 0.8.20, optimizer on, runs 200, viaIR true).
- **Manual fallback:** Contract → "Verify and Publish" → "Via Standard JSON Input" → upload the standard-input JSON from `artifacts` or Hardhat’s cache, set compiler and optimization to match deployment exactly, paste ABI-encoded constructor arguments if needed.

### 4.2 Story Aeneid (StoryScan / Blockscout)

- **Explorer:** https://aeneid.storyscan.io  
- **API:** Blockscout-style; often **no API key** required for verification. In Hardhat `etherscan.apiKey` you can set a placeholder (e.g. `"no-api-key-needed"`) if the plugin requires a value.
- **Custom chain:** In `hardhat.config.js` add a `customChains` entry with `network: "storyAeneid"`, `chainId: 1315`, and the correct `apiURL` / `browserURL` for Story Aeneid.
- **Verification:** Run verify scripts or `hardhat verify --network storyAeneid <address> <args...>`; ensure compiler version and optimizer settings match the deployment (e.g. 0.8.20, viaIR, same runs).

### 4.3 Verification checklist

- Compiler version and optimization (runs, viaIR) must **exactly** match the deployment.
- Constructor arguments must be ABI-encoded correctly (order and types as in the contract).
- For proxy or factory patterns, verify the implementation and then the proxy/factory if the explorer supports it.
- Save verified contract addresses and verification tx/links in `DEPLOYMENT.md` or similar for audits and support.

### 4.4 What to avoid (verification)

- Do not change optimizer runs or compiler between deploy and verify.
- Do not omit constructor arguments or use wrong order.
- Do not assume BaseScan and StoryScan use the same API; configure each network in Hardhat’s `etherscan` / `customChains`.

---

## Part 5: Gas and How Long to Wait

### 5.1 Gas to have on each chain

- **Base Sepolia:** Deployer/attester/executor needs **ETH** for deploy, relay, and (for executor) any Base-side calls. For testnet, ~0.1–0.2 ETH is usually enough for many deploys and relay txs.
- **Story Aeneid:** Deployer/attester/verifier/executor needs **native token (IP)**. Use a fixed gas price (e.g. 10 gwei) if the chain supports it; in Hardhat you can set `gasPrice: 10000000000` for Story Aeneid. Have enough to deploy all contracts and run verifier + executor for a while (e.g. 24–48 hours of polling).
- **Relayer (Fly.io):** The same attester/executor key must hold gas on **both** chains; top up periodically or monitor balances.

### 5.2 How long to wait

- **Custom bridge:** After a lock tx is confirmed on Base, the relayer typically picks it up within one poll interval (e.g. 15 s). Fulfill on Story then takes 1–2 block confirmations. End-to-end: usually under 1–2 minutes.
- **LayerZero:** After send on Base, verifier must see PacketSent and commit on Story (1–2 poll cycles), then executor must see PacketVerified and call lzReceive. With 10 s poll and retries, expect **~1–2 minutes** for the first successful path; under load or RPC lag, allow up to a few minutes before investigating.
- **Verification:** Block explorers may take 30 s–2 minutes to show "Verified" after the verify tx is accepted.

---

## Part 6: Mainnet Considerations

### 6.1 Solidity and security

- **Get a Solidity review before mainnet.** Cross-chain and token logic (mint, burn, lock, replay protection, access control) are easy to get wrong. A dedicated Solidity/audit programmer can catch reentrancy, integer overflow (even with 0.8.x), access control gaps, and bridge-specific issues (e.g. nonce reuse, wrong chain IDs).
- **Document assumptions:** Attester trust, relayer availability, upgradeability (or lack of), and what happens if the relayer is down or keys are compromised.
- **Testnets first:** Run both bridges end-to-end on Base Sepolia and Story Aeneid (or equivalent testnets) with real flows and failure cases (e.g. executor retries, verifier behind, RPC 429).

### 6.2 Operational and economic

- **Relayer/worker uptime:** For mainnet, run verifier and executor (and custom relayer if used) in a robust environment (e.g. Fly.io with health checks and alerts). Plan for RPC failover and key management.
- **Gas and fees:** Mainnet gas is volatile; consider gas limits and max fee settings so txs don’t stall. For L2/mainnet, re-estimate gas and fee parameters.
- **Liquidity and caps:** If the destination token is backed by locked assets, consider caps or circuit breakers for mainnet until you’re confident in the system.

### 6.3 What to avoid (mainnet)

- Do not deploy unverified or unreviewed contracts to mainnet.
- Do not rely on a single RPC or a single machine for relayers/workers.
- Do not hardcode mainnet private keys or API keys in the repo; use env and secrets only.

---

## Part 7: Token Naming and Branding (USDC.k / Krump USDC)

### 7.1 Why it matters

- Explorers and wallets show **contract name and symbol**. If the contract says "WrappedUSDC" or "BridgeUSDC," that’s what users see. For a product like Krump USDC, use a **clear, branded** name and symbol in the contract.
- **Recommendation:** Set `name` to something like **"USDC Krump"** or **"Krump USDC"** and `symbol` to **"USDC.k"** (or your chosen ticker) in the ERC20 constructor so that:
  - Block explorers show the right asset.
  - Users and partners see a consistent brand (e.g. USDC.k) rather than a generic wrapper name.

### 7.2 Where to set it

- **Custom bridge:** In the BridgeUSDC (or equivalent) constructor, pass the desired name and symbol.
- **LayerZero OFT:** In the OAppProxyOFT or wrapped token deployment, pass the same branding so both bridges present a consistent "USDC.k" on the destination chain if they feed the same token or the same ecosystem.

### 7.3 Consistency

- If you have two bridges delivering to the same chain, decide whether they mint the same token (same contract) or two different tokens. If different, still use consistent naming (e.g. both "USDC.k" with different contract addresses documented) to avoid user confusion.

---

## Part 8: Adding Credits to Deployed Smart Contracts (Ownership / Disputes)

### 8.1 Why credits in contracts

- **Attribution and disputes:** If ownership or authorship is disputed later, having immutable credits (author, project, license) in the contract or in verification metadata helps. It doesn’t change behavior but documents who deployed or designed the system.
- **Best practice:** Add a short comment or constant in the contract (e.g. `/// @title BridgeUSDC - USDC.k for Krump. Author: StreetKode Fam. License: MIT`) or emit an event on deployment with author/project info. Alternatively, document the same in the verified source (comments) so explorers show it.

### 8.2 How to add credits

- **In Solidity:** Add NatSpec `@author`, `@title`, and `@notice` at the top of the contract. Optionally a constant string (e.g. `string public constant CREDITS = "StreetKode Fam Initiative; ...";`) or an event emitted once in the constructor. Keep it short to avoid blowing contract size.
- **In deployment scripts:** Log the deployer address, network, and timestamp; store in `DEPLOYMENT.md` or `deployments/*.json` with a `credits` or `deployedBy` field.
- **In verification:** When you verify, the explorer will show the source including comments; that becomes the public record.

### 8.3 What to avoid

- Do not put private keys or sensitive data in contract comments or constants.
- Do not rely only on off-chain docs; on-chain or verified-source credits are harder to alter after deployment.

---

## Part 9: Best Practices with Cursor and GitHub

### 9.1 Cursor

- **Rules and skills:** Use `.cursor/rules` or project rules to encode stack (e.g. Hardhat, Node, Solidity), env vars (never commit `.env`), and patterns (e.g. "use BASE_SEPOLIA_RPC from env"). Create or use skills for verification steps, deploy order, and relayer env so the AI suggests consistent commands.
- **Debugging:** When debugging (e.g. executor revert), use instrumentation and logs to confirm hypotheses (e.g. double-execute, RPC lag) before changing logic. Remove temporary logs after the fix is verified.
- **Secrets:** Never paste real keys or API keys into chat or into files that get committed. Reference env var names only (e.g. "set BRIDGE_ATTESTER_KEY in Fly secrets").

### 9.2 GitHub

- **.gitignore:** Ignore `.env`, `node_modules/`, `deployments/*.json` (or only track `*-latest.json` if you want), `.cursor/debug.log`, and any local keys or credentials.
- **README and docs:** Keep one main README at the repo root with project structure, two-bridge overview, quick start (custom bridge + LZ), and links to verification and deployment docs. Use relative links and correct paths (e.g. `LayerZero - Story Aeneid/lz-bridge/...`) so they work from the repo root.
- **Commits:** Prefer small, logical commits (e.g. "fix: executor double-execute by re-checking inboundNonce before send"). Merge main into your branch before pushing to avoid unrelated-history merges when possible.
- **Secrets:** Never commit `.env` or hardcoded keys. Use GitHub Actions secrets or Fly.io secrets for CI and production; document which env vars are required in README or CONTRIBUTING.

### 9.3 Repo structure

- Keep contracts, scripts, and config in one place (e.g. `lz-bridge/`); keep the frontend (e.g. `bridge-ui/`) separate. Document the layout in the README so Cursor and contributors know where to find deploy, verify, and relayer scripts.
- After merging unrelated histories (e.g. initial push to an existing GitHub repo), resolve conflicts in `.gitignore` and any paths; then document the final structure in the README.

---

## Part 10: Quick Reference Table

| Topic | Custom Bridge | LayerZero OAppProxyOFT |
|-------|----------------|------------------------|
| **Deploy order** | Vault (Base) → Receiver + USDC.k (Story) → EVVM adapter (Story) | Endpoint + libs → OAppProxyOFT → VerifierDVN; configure ULN |
| **Who runs it** | You (relayer) | You (verifier + executor) |
| **Gas needed** | Attester: both chains | Verifier: Story only; Executor: Story (+ Base RPC) |
| **RPC** | HTTP for Hardhat; set secrets separately on Fly | HTTP for Hardhat; WSS optional for workers (separate env var) |
| **Verification** | BaseScan (API key) + StoryScan (no key) | Same; match compiler and optimizer |
| **Naming** | Set USDC.k / Krump USDC in BridgeUSDC constructor | Set in OAppProxyOFT/wrapped token |
| **Credits** | NatSpec / constant / event in contract + DEPLOYMENT.md | Same |

---

## Summary

- **Two bridges:** Custom (lock/fulfill + relayer) and LayerZero (verifier + executor); both can target the same branded USDC.k.
- **Verification:** Base Sepolia via BaseScan (API key); Story Aeneid via StoryScan (Blockscout); match compiler and optimizer; use Standard JSON Input if needed.
- **Gas and time:** Fund attester/verifier/executor on both chains; expect ~1–2 minutes for a full bridge cycle; verification can take 1–2 minutes after submit.
- **Mainnet:** Solidity review, testnets first, robust relayer/worker deployment, no secrets in repo.
- **Naming:** Use "USDC.k" / "Krump USDC" (or your brand) in contract name/symbol.
- **Credits:** NatSpec/comments or constants in contracts; document deployer and project in DEPLOYMENT.md and verified source.
- **Cursor/GitHub:** Rules and .gitignore; no secrets in repo; clear README and structure; small, descriptive commits.

Use this file as the single source to paste into Lovable or to onboard contributors and auditors.
