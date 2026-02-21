# Quick Manual Verification - Base Sepolia OAppProxyOFT

## 📋 Contract Info

- **Address**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- **Link**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

## 🚀 Quick Steps

### 1. Go to BaseScan
👉 https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

### 2. Click "Verify and Publish"

### 3. Select "Via Standard JSON Input"

### 4. Settings
- **Compiler**: `0.8.20`
- **Optimization**: ✅ Yes, Runs: `1`, viaIR: ✅ Yes
- **License**: MIT

### 5. Standard JSON Input
The Standard JSON file is in: `artifacts/build-info/[hash].json`

Find the file containing `OAppProxyOFT`:
```bash
grep -l "OAppProxyOFT" artifacts/build-info/*.json
```

Copy the **entire contents** of that file and paste into BaseScan.

### 6. Constructor Arguments
Paste this JSON array:
```json
["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x6EDCE65403992e310A62460808c4b910D972f10f","0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"]
```

### 7. Submit
Click "Verify and Publish" ✅

## 📝 Constructor Arguments Explained

1. `0x036CbD53842c5426634e7929541eC2318f3dCF7e` - USDC token address
2. `0x6EDCE65403992e310A62460808c4b910D972f10f` - LayerZero endpoint
3. `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25` - Delegate address

## ✅ After Verification

Once verified, you'll see:
- Full source code
- Contract interaction interface
- All functions and events

---

**Note**: Automated verification via Hardhat requires Etherscan API V2 migration, which isn't fully supported yet. Manual verification is the fastest option.
