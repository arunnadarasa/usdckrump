# Full Implementation: x402 with EVVM and USDC Krump

Instruction guide for integrating EIP-3009 (x402) with EVVM Core for programmable USDC.k payments on Story Aeneid. Use this for documentation sites (e.g. usdckrumpguide.lovable.app).

---

## 1. Payment Flow (High Level)

1. **Agent A (payer)** signs an x402 authorization (EIP-3009-style EIP-712) to the adapter.
2. **Agent A** signs the EVVM EIP-191 payment message (hash payload + comma-separated message).
3. **Adapter** verifies the x402 signature and calls `Core.pay(from, to, ...)` with the EVVM signature.
4. **Core** verifies the EVVM signature and updates internal balances (or, with the legacy adapter, the adapter first pulls USDC.k via `transferWithAuthorization`, then calls Core).

**EVVM Native adapter (recommended):** The payer must have USDC.k **internal balance** in EVVM first (deposit via Treasury). Core does not pull from the wallet.

---

## 2. Contract Addresses (Story Aeneid)

| Name | Address |
|------|---------|
| **EVVM Core** | `0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b` |
| **EVVM ID** | `1140` |
| **USDC.k (BridgeUSDC)** | `0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5` |
| **EVVM Native x402 adapter** | `0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc` |
| **EVVM Treasury** (for deposit) | `0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc` |
| **Chain ID** | `1315` |
| **RPC** | `https://aeneid.storyrpc.io` |

---

## 3. x402 Signature (EIP-3009-Style, EIP-712)

Used so the adapter (or token) can verify “payer authorizes this transfer.”

**Domain**

- `name`: `"USDC Dance"`
- `version`: `"1"`
- `chainId`: `1315`
- `verifyingContract`: **adapter address** for EVVM Native adapter, or **USDC.k token address** for the legacy adapter.

**Type**

```
TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)
```

**Struct hash**

```
structHash = keccak256(abi.encode(
  typeHash,
  from,
  to,        // adapter address for native flow
  amount,
  validAfter,
  validBefore,
  nonce
));
```

**Digest and sign**

```
digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
signature = sign(digest);  // ECDSA v,r,s
```

**JavaScript/TypeScript (ethers v6)**

```javascript
const domain = {
  name: 'USDC Dance',
  version: '1',
  chainId: 1315,
  verifyingContract: adapterAddress,  // or usdcKAddress for legacy
};
const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};
const value = { from, to: adapterAddress, amount, validAfter, validBefore, nonce };
const signature = await signer.signTypedData(domain, types, value);
// use signature.v, signature.r, signature.s
```

**Important:** For the **EVVM Native** adapter, `verifyingContract` and `to` must be the **adapter** address. For the legacy (token EIP-3009) flow, `verifyingContract` is the USDC.k token and `to` is the adapter.

---

## 4. EVVM Signature (EIP-191)

Core expects a **comma-separated string** signed with `personal_sign` (EIP-191). The hash payload and message must match the contract byte-for-byte.

### Step 1: Hash Payload (CoreHashUtils.hashDataForPay)

```javascript
const hashPayload = keccak256(
  abi.encode(
    "pay",         // MUST be first argument
    to_address,    // recipient
    to_identity,   // string (e.g. "")
    token,         // USDC.k address
    amount,        // uint256
    priorityFee    // uint256 (e.g. 0)
  )
);
```

**TypeScript (ethers v6):**

```javascript
const hashPayloadBytes = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['string', 'address', 'string', 'address', 'uint256', 'uint256'],
    ['pay', to, toIdentity ?? '', token, amount, priorityFee]
  )
);
const hashPayloadHex = hashPayloadBytes.toLowerCase();
```

### Step 2: Message String (AdvancedStrings.buildSignaturePayload)

The contract builds one **comma-separated string**. You must build the same string:

```
evvmId,evvmCoreAddress,hashPayload,executor,nonce,isAsyncExec
```

- **evvmId**: `"1140"`
- **evvmCoreAddress**: Core address, **lowercase** (e.g. `0xa6a02e8e17b819328ddb16a0ad31dd83dd14ba3b`)
- **hashPayload**: hex from Step 1, **lowercase**
- **executor**: `"0x0000000000000000000000000000000000000000"` (or executor address, lowercase)
- **nonce**: decimal string (e.g. async nonce)
- **isAsyncExec**: `"true"` or `"false"`

**TypeScript:**

```javascript
const message = [
  String(evvmId),
  evvmCoreAddress.toLowerCase(),
  hashPayloadHex,
  (senderExecutor || ethers.ZeroAddress).toLowerCase(),
  String(nonce),
  isAsyncExec ? 'true' : 'false',
].join(',');

const signature = await signer.signMessage(message);  // EIP-191 personal_sign
```

Do **not** ABI-encode this message; sign the **UTF-8 string** as-is.

---

## 5. EVVM Nonce

- **Async:** Pick a unique nonce (e.g. from a hash), then call `evvmCore.getIfUsedAsyncNonce(from, nonce)`; if already used, pick another.
- **Sync:** Use `evvmCore.getNextCurrentSyncNonce(from)`.

---

## 6. Adapter Call: payViaEVVMWithX402

Pass the two signatures and nonces into the adapter:

```
payViaEVVMWithX402(
  from,
  to,              // recipient
  toIdentity,      // "" or EVVM identity
  amount,
  validAfter,
  validBefore,
  nonce,           // x402 nonce (bytes32)
  v, r, s,         // x402 signature
  receiptId,
  evvmNonce,
  isAsyncExec,
  evvmSignature    // bytes from signMessage(message)
)
```

The payer’s wallet must submit this transaction (or a relayer with the payer’s approval).

---

## 7. EVVM Deposit (Required for Native Adapter)

Core moves **internal** balances only; it does not pull USDC.k from the wallet. So for the **EVVM Native** adapter, the payer must have USDC.k balance **inside EVVM** first:

1. **Approve Treasury:**  
   `USDC.k.approve(TreasuryAddress, amount)`  
   Treasury: `0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc`

2. **Deposit:**  
   `Treasury.deposit(USDC.k_address, amount)`

After that, `Core.pay(...)` can debit the payer’s internal USDC.k balance.

---

## 8. Common Mistakes

1. **Missing `"pay"` in hash**  
   The hash must be `keccak256(abi.encode("pay", to, to_identity, token, amount, priorityFee))`. If `"pay"` is omitted or not first, the signature will not match and you get “EVVM payment failed”.

2. **ABI-encoding the EVVM message**  
   The contract expects a **comma-separated string**. Do not ABI-encode that string; sign the raw UTF-8 message (EIP-191).

3. **Wrong serviceAddress**  
   Core uses `address(this)` (the Core contract) as `serviceAddress`. The signer must use the **Core address** in the message string, not the adapter.

4. **Wrong x402 verifyingContract**  
   For the **Native** adapter, use the **adapter** as EIP-712 `verifyingContract` and as `to`. For the **legacy** adapter, use the **token** as `verifyingContract` and the adapter as `to`.

5. **Native adapter without deposit**  
   For the Native adapter, the payer must have deposited USDC.k via Treasury first; otherwise Core has no internal balance to debit.

---

## 9. Environment Setup (.env)

```env
# Payer (64 hex chars, optional 0x prefix)
AGENT_A_PRIVATE_KEY=0x...

# Receiver (or use AGENT_B_ADDRESS)
AGENT_B_PRIVATE_KEY=0x...
AGENT_B_ADDRESS=0x...

# 0.5 USDC.k = 500000 (6 decimals)
PAYMENT_AMOUNT=500000

# Story Aeneid
STORY_AENEID_RPC=https://aeneid.storyrpc.io
```

---

## 10. End-to-End (EVVM Native) Checklist

1. Payer has USDC.k in wallet and has **deposited** USDC.k into EVVM (approve Treasury → `Treasury.deposit(USDC.k, amount)`).
2. Generate unique x402 nonce and EVVM nonce (and check async nonce not already used).
3. Sign x402 with EIP-712 (domain + `TransferWithAuthorization`), `to` = adapter, `verifyingContract` = adapter.
4. Build EVVM hash payload with `"pay"` first, then build the comma-separated message and sign with `signMessage(message)`.
5. Call adapter `payViaEVVMWithX402(...)` with both signatures and nonces.

---

**Credits:** StreetKode Fam (Asura, Hectik, Kronos, Jo) · EVVM 1140
