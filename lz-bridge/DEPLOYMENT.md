# Deployment Summary - USDC Dance LayerZero Bridge

**Deployment Date**: February 19, 2026  
**Networks**: Base Sepolia (84532) ↔ Story Aeneid (1315)

---

## 🎯 Project Overview

Cross-chain bridge for **USDC Dance** (USDC.d) tokens enabling:
- ✅ LayerZero V2 cross-chain transfers
- ✅ x402 protocol compliance (EIP-3009)
- ✅ EVVM integration for autonomous agent payments
- ✅ OpenClaw agent compatibility

**Author**: Asura aka Angel of Indian Krump  
**Website**: https://asura.lovable.app/  
**Initiative**: StreetKode Fam Initiative  
**Credits**: StreetKode Fam: Asura, Hectik, Kronos, Jo

---

## 📋 Deployed Contracts

### Story Aeneid (Chain ID: 1315)

#### LayerZero Infrastructure
- **EndpointV2**: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4`
  - [View on StoryScan](https://aeneid.storyscan.io/address/0xdB09C62692B837C6bd8E53dF33957E5f018A68B4#code)
  - EID: 1315
  - Owner: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25`

- **SendUln302**: `0xB00b22e8D0E8840B979B899Eb125b5db3C0E4aA2`
  - [View on StoryScan](https://aeneid.storyscan.io/address/0xB00b22e8D0E8840B979B899Eb125b5db3C0E4aA2#code)
  - Treasury Gas Limit: 50,000
  - Treasury Gas Fee Cap: 1 IP

- **ReceiveUln302**: `0xbcBe64F771027571573e88750BE19F487e9c9F68`
  - [View on StoryScan](https://aeneid.storyscan.io/address/0xbcBe64F771027571573e88750BE19F487e9c9F68#code)

#### Token Contracts
- **USDCDanceOFT**: `0xa594b9F302D411A7c2bB7d599eb7C635f3535b00`
  - [View on StoryScan](https://aeneid.storyscan.io/address/0xa594b9F302D411A7c2bB7d599eb7C635f3535b00#code)
  - Token Name: USDC Dance
  - Token Symbol: USDC.d
  - Decimals: 6
  - Endpoint: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4`

#### EVVM Integration
- **EVVMPaymentAdapter**: `0x756863f1161B34C49eC5D65cbd15326Cab060123`
  - [View on StoryScan](https://aeneid.storyscan.io/address/0x756863f1161B34C49eC5D65cbd15326Cab060123#code)
  - USDC.d Token: `0xa594b9F302D411A7c2bB7d599eb7C635f3535b00`
  - EVVM Core: `0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b`
  - EVVM ID: 1140 (KrumpChain)
  - Owner: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25`

### Base Sepolia (Chain ID: 84532)

#### Token Contracts
- **USDCDanceOFT**: `0x6a7f89eB3879FeF28Ad37022Eee9e1316284A21b`
  - Token Name: USDC Dance
  - Token Symbol: USDC.d
  - Decimals: 6
  - Endpoint: `0x6EDCE65403992e310A62460808c4b910D972f10f` (Official LayerZero endpoint)

---

## 🔗 Cross-Chain Configuration

### OFT Pair Linking
✅ **Linked**: Base Sepolia ↔ Story Aeneid
- Base OFT trusts Story OFT (EID 1315)
- Story OFT trusts Base OFT (EID 84532)

### LayerZero Endpoints
- **Base Sepolia**: `0x6EDCE65403992e310A62460808c4b910D972f10f` (Official)
- **Story Aeneid**: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4` (Custom deployment)

---

## 🔐 EVVM Configuration

**EVVM ID**: 1140 (KrumpChain)  
**EVVM Core**: `0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b`

**EVVM Components**:
- Staking: `0x8F89cBe21d5d03cF24F0C2b084E377bdbbce72CD`
- Estimator: `0x33569b317a2901f11D84D2067E060014f8C6208c`
- NameService: `0x2136Bb44415B6227Ab46f9080739b8A54aE56B6B`
- Treasury: `0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc`
- P2PSwap: `0xdb1934b7d039FAb96D0F041053E4056ce4954AD2`

**Principal Token**: KRUMP (JAB) - `0x0000000000000000000000000000000000000001`  
**Payment Token**: USDC.d - `0xa594b9F302D411A7c2bB7d599eb7C635f3535b00`

---

## 📝 Contract Verification

All contracts are verified on StoryScan with:
- ✅ Author credits (Asura aka Angel of Indian Krump)
- ✅ Website link (https://asura.lovable.app/)
- ✅ StreetKode Fam Initiative credits
- ✅ Full NatSpec documentation

---

## 🚀 Usage

### Cross-Chain Transfer (Base Sepolia → Story Aeneid)

```javascript
// On Base Sepolia
const usdcDance = await ethers.getContractAt("USDCDanceOFT", "0x6a7f89eB3879FeF28Ad37022Eee9e1316284A21b");

const sendParam = {
  dstEid: 1315, // Story Aeneid
  to: ethers.zeroPadValue("0xa594b9F302D411A7c2bB7d599eb7C635f3535b00", 32), // Story OFT address
  amountLD: ethers.parseUnits("100", 6), // 100 USDC.d
  minAmountLD: ethers.parseUnits("100", 6),
  extraOptions: "0x",
  composeMsg: "0x",
  oftCmd: "0x"
};

const fee = {
  nativeFee: ethers.parseEther("0.001"), // Gas fee
  lzTokenFee: 0
};

await usdcDance.send(sendParam, fee, payable(sender));
```

### x402 Payment via EVVM

```javascript
// On Story Aeneid
const adapter = await ethers.getContractAt(
  "EVVMPaymentAdapter",
  "0x756863f1161B34C49eC5D65cbd15326Cab060123"
);

await adapter.payViaEVVMWithX402(
  from,
  to,
  toIdentity,
  amount,
  validAfter,
  validBefore,
  nonce,
  v,
  r,
  s,
  receiptId,
  evvmNonce,
  isAsyncExec,
  evvmSignature
);
```

---

## 🔍 Verification Commands

```bash
# Verify all contracts
npm run verify:contracts

# View verification helper
npm run verify:story
```

---

## 📚 Documentation

- [LayerZero V2 Docs](https://docs.layerzero.network/v2/)
- [EVVM Documentation](https://www.evvm.info/llms-full.txt)
- [x402 Protocol](https://x402.dev/)

---

## ⚠️ Important Notes

1. **Testnet Only**: All deployments are on testnet
2. **ULN Configuration**: Default libraries not yet configured - configure per-OApp as needed
3. **Gas Requirements**: Ensure sufficient IP on Story Aeneid for gas
4. **Executor**: Not deployed - messages will be delivered by LayerZero's infrastructure

---

## 🎉 Credits

**StreetKode Fam Initiative**
- Asura aka Angel of Indian Krump
- Hectik
- Kronos
- Jo

**Website**: https://asura.lovable.app/

---

## 📞 Support

For issues or questions:
- Check deployment files in `deployments/` directory
- Review contract source code on StoryScan
- Consult LayerZero V2 documentation
