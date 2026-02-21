# Contract Verification Guide

## 📋 Contracts to Verify

### Base Sepolia
1. **OAppProxyOFT**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`

### Story Aeneid
1. **OAppProxyOFT**: `0xB635b0Ad94D0995f166cbd9498832101cdda8508`
2. **WrappedUSDC**: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4`

## 🔧 Automated Verification

### Story Aeneid (Blockscout - No API Key Needed)

```bash
# Verify WrappedUSDC
npm run verify:wrapped-usdc-story

# Verify OAppProxyOFT
npm run verify:proxy-oft-story
```

### Base Sepolia (BaseScan - Requires API Key)

**Note**: BaseScan now uses Etherscan API V2. Update your `.env`:

```bash
# Use Etherscan API V2 format
ETHERSCAN_API_KEY=your_api_key_here
```

Then run:
```bash
npm run verify:proxy-oft-base
```

## 📝 Manual Verification

If automated verification fails, use manual verification:

### Base Sepolia - OAppProxyOFT

1. **Go to**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code
2. **Click**: "Verify and Publish"
3. **Select**: "Via Standard JSON Input"
4. **Compiler**: `0.8.20`
5. **Optimization**: Yes, Runs: 1, viaIR: true
6. **Constructor Arguments** (ABI-encoded):
   ```
   0x000000000000000000000000036CbD53842c5426634e7929541eC2318f3dCF7e0000000000000000000000006EDCE65403992e310A62460808c4b910D972f10f00000000000000000000000035df28Db852f528282Dd26AAa0C3968aac1d3a25
   ```
   
   Or as JSON array:
   ```json
   [
     "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
     "0x6EDCE65403992e310A62460808c4b910D972f10f",
     "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"
   ]
   ```

### Story Aeneid - OAppProxyOFT

1. **Go to**: https://aeneid.storyscan.io/address/0xB635b0Ad94D0995f166cbd9498832101cdda8508#code
2. **Click**: "Verify and Publish"
3. **Select**: "Via Standard JSON Input"
4. **Compiler**: `0.8.20`
5. **Optimization**: Yes, Runs: 1, viaIR: true
6. **Constructor Arguments** (ABI-encoded):
   ```
   0x0000000000000000000000007d3E90a670400465f84c0892DF9a4f2bE2d168a4000000000000000000000000dB09C62692B837C6bd8E53dF33957E5f018A68B400000000000000000000000035df28Db852f528282Dd26AAa0C3968aac1d3a25
   ```
   
   Or as JSON array:
   ```json
   [
     "0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4",
     "0xdB09C62692B837C6bd8E53dF33957E5f018A68B4",
     "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"
   ]
   ```

### Story Aeneid - WrappedUSDC

1. **Go to**: https://aeneid.storyscan.io/address/0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4#code
2. **Click**: "Verify and Publish"
3. **Select**: "Via Standard JSON Input"
4. **Compiler**: `0.8.20`
5. **Optimization**: Yes, Runs: 1, viaIR: true
6. **Constructor Arguments** (ABI-encoded):
   ```
   0x0000000000000000000000000000000000000000000000000000000000000000
   ```
   
   Or as JSON array:
   ```json
   ["0"]
   ```

## 🔑 Getting Standard JSON Input

To get the Standard JSON Input for verification:

```bash
# For OAppProxyOFT
npx hardhat flatten contracts/OAppProxyOFT.sol > OAppProxyOFT-flattened.sol

# For WrappedUSDC
npx hardhat flatten contracts/WrappedUSDC.sol > WrappedUSDC-flattened.sol
```

Or use Hardhat's standard JSON export:

```bash
npx hardhat compile --force
# Standard JSON is in artifacts/build-info/
```

## 📊 Verification Status

| Contract | Network | Address | Status |
|----------|---------|---------|--------|
| OAppProxyOFT | Base Sepolia | 0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627 | ⚠️ Pending |
| OAppProxyOFT | Story Aeneid | 0xB635b0Ad94D0995f166cbd9498832101cdda8508 | ⚠️ Pending |
| WrappedUSDC | Story Aeneid | 0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4 | ⚠️ Pending |

## 🛠️ Troubleshooting

### BaseScan API V2 Migration

If you see "deprecated V1 endpoint" error:

1. Get API key from: https://etherscan.io/apis
2. Update `.env`:
   ```bash
   ETHERSCAN_API_KEY=your_api_key_here
   ```
3. Remove `BASESCAN_API_KEY` if present (use `ETHERSCAN_API_KEY` instead)

### Constructor Arguments Encoding

If manual encoding is needed, use this helper:

```javascript
const { ethers } = require("ethers");
const abi = ethers.AbiCoder.defaultAbiCoder();
const encoded = abi.encode(
  ["address", "address", "address"],
  [
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "0x6EDCE65403992e310A62460808c4b910D972f10f",
    "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"
  ]
);
console.log(encoded);
```

## ✅ After Verification

Once verified, update the links:
- Base Sepolia: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code
- Story Aeneid OAppProxyOFT: https://aeneid.storyscan.io/address/0xB635b0Ad94D0995f166cbd9498832101cdda8508#code
- Story Aeneid WrappedUSDC: https://aeneid.storyscan.io/address/0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4#code
