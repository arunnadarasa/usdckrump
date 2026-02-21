# Contract Verification Status

## ✅ Verified Contracts

### Story Aeneid

1. **WrappedUSDC** ✅
   - Address: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4`
   - StoryScan: https://aeneid.storyscan.io/address/0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4#code
   - Verified: ✅ February 20, 2026

2. **OAppProxyOFT** ✅
   - Address: `0xB635b0Ad94D0995f166cbd9498832101cdda8508`
   - StoryScan: https://aeneid.storyscan.io/address/0xB635b0Ad94D0995f166cbd9498832101cdda8508#code
   - Verified: ✅ February 20, 2026

## ⚠️ Pending Verification

### Base Sepolia

1. **OAppProxyOFT** ⚠️
   - Address: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
   - BaseScan: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code
   - Status: Requires Etherscan API V2

## 🔧 How to Verify Base Sepolia Contract

### Option 1: Update to Etherscan API V2 (Recommended)

1. Get API key from: https://etherscan.io/apis
2. Update `.env`:
   ```bash
   ETHERSCAN_API_KEY=your_api_key_here
   ```
3. Run verification:
   ```bash
   npm run verify:proxy-oft-base
   ```

### Option 2: Manual Verification

Run the manual verification helper:
```bash
node scripts/verify-oapp-proxy-oft-base-manual.js
```

Then follow the instructions to verify manually on BaseScan.

**Constructor Arguments**:
```json
[
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"
]
```

**Compiler Settings**:
- Version: 0.8.20
- Optimization: Enabled
- Runs: 1
- viaIR: true

## 📊 Summary

| Contract | Network | Address | Status |
|----------|---------|---------|--------|
| WrappedUSDC | Story Aeneid | 0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4 | ✅ Verified |
| OAppProxyOFT | Story Aeneid | 0xB635b0Ad94D0995f166cbd9498832101cdda8508 | ✅ Verified |
| OAppProxyOFT | Base Sepolia | 0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627 | ⚠️ Pending |

---

**Last Updated**: February 20, 2026
