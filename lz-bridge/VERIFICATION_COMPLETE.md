# Contract Verification Status

## ✅ Successfully Verified

### Story Aeneid Contracts

1. **WrappedUSDC**
   - Address: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4`
   - StoryScan: https://aeneid.storyscan.io/address/0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4#code
   - Status: ✅ **VERIFIED**

2. **OAppProxyOFT**
   - Address: `0xB635b0Ad94D0995f166cbd9498832101cdda8508`
   - StoryScan: https://aeneid.storyscan.io/address/0xB635b0Ad94D0995f166cbd9498832101cdda8508#code
   - Status: ✅ **VERIFIED**

## ⚠️ Manual Verification Required

### Base Sepolia - OAppProxyOFT

- **Address**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- **BaseScan**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code
- **Status**: ⚠️ **PENDING** (Requires manual verification)

**Reason**: BaseScan requires Etherscan API V2, which Hardhat's verify plugin doesn't fully support yet.

## 🔧 Manual Verification Steps

### Quick Guide

1. **Go to**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

2. **Click**: "Verify and Publish"

3. **Select**: "Via Standard JSON Input"

4. **Settings**:
   - Compiler: `0.8.20`
   - Optimization: ✅ Yes
   - Runs: `1`
   - viaIR: ✅ Yes
   - License: MIT

5. **Standard JSON Input**:
   - File: `artifacts/build-info/74908da3e5e4d7f89da4e8e316a82721.json`
   - Copy the **entire file contents** and paste

6. **Constructor Arguments**:
   ```json
   ["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x6EDCE65403992e310A62460808c4b910D972f10f","0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"]
   ```

7. **Submit**: Click "Verify and Publish"

### Alternative: Flattened Source

If Standard JSON doesn't work:

```bash
npx hardhat flatten contracts/OAppProxyOFT.sol > OAppProxyOFT-flattened.sol
```

Then use "Via flattened source code" option.

## 📊 Summary

| Contract | Network | Address | Status | Link |
|----------|---------|---------|--------|------|
| WrappedUSDC | Story Aeneid | 0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4 | ✅ Verified | [View](https://aeneid.storyscan.io/address/0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4#code) |
| OAppProxyOFT | Story Aeneid | 0xB635b0Ad94D0995f166cbd9498832101cdda8508 | ✅ Verified | [View](https://aeneid.storyscan.io/address/0xB635b0Ad94D0995f166cbd9498832101cdda8508#code) |
| OAppProxyOFT | Base Sepolia | 0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627 | ⚠️ Pending | [Verify](https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code) |

## 📝 Files Created

- `VERIFY_CONTRACTS.md` - Complete verification guide
- `VERIFY_BASE_SEPOLIA_MANUAL.md` - Detailed manual steps
- `QUICK_VERIFY_BASE_SEPOLIA.md` - Quick reference
- `VERIFICATION_STATUS.md` - Status tracking

## 🎯 Next Steps

1. ✅ Story Aeneid contracts - **DONE**
2. ⚠️ Verify Base Sepolia contract manually (5 minutes)
3. ✅ Update documentation with verified links

---

**Last Updated**: February 20, 2026
