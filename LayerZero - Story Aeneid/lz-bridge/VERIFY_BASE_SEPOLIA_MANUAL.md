# Manual Verification for Base Sepolia OAppProxyOFT

Since BaseScan requires Etherscan API V2 and Hardhat's verify plugin hasn't fully migrated yet, here's how to verify manually:

## Contract Details

- **Address**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- **BaseScan**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

## Step-by-Step Manual Verification

### 1. Get Standard JSON Input

```bash
cd "/Users/openclaw/Documents/USDC Krump/LayerZero - Story Aeneid/lz-bridge"
npm run build
```

The Standard JSON Input file will be in:
```
artifacts/build-info/[hash].json
```

Find the file that contains `OAppProxyOFT` in its content.

### 2. Go to BaseScan

Visit: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

### 3. Click "Verify and Publish"

Click the "Verify and Publish" button (usually in the "Contract" tab).

### 4. Select Verification Method

Choose: **"Via Standard JSON Input"**

### 5. Fill in Details

- **Compiler Type**: `Solidity (Single file)`
- **Compiler Version**: `0.8.20`
- **Open Source License Type**: `MIT`
- **Optimization**: ✅ **Yes**
- **Runs**: `1`
- **Enable viaIR**: ✅ **Yes**

### 6. Upload Standard JSON Input

- Copy the entire contents of the Standard JSON file from `artifacts/build-info/[hash].json`
- Paste it into the "Standard JSON Input" field

### 7. Constructor Arguments

Paste this JSON array:
```json
["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x6EDCE65403992e310A62460808c4b910D972f10f","0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"]
```

Or as ABI-encoded (if required):
```
0x000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e0000000000000000000000006edce65403992e310a62460808c4b910d972f10f00000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25
```

### 8. Submit

Click "Verify and Publish" and wait for confirmation.

## Alternative: Flattened Source Code

If Standard JSON doesn't work, try flattened source:

```bash
npx hardhat flatten contracts/OAppProxyOFT.sol > OAppProxyOFT-flattened.sol
```

Then use "Via flattened source code" option and paste the flattened file.

## Constructor Arguments Breakdown

1. **Token**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle's USDC on Base Sepolia)
2. **Endpoint**: `0x6EDCE65403992e310A62460808c4b910D972f10f` (Official LayerZero Endpoint)
3. **Delegate**: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25` (Your deployer address)

## After Verification

Once verified, the contract will show:
- ✅ Source code
- ✅ Read/Write contract functions
- ✅ Events and logs
- ✅ Full contract interaction interface

---

**Your API Key**: `9Q5VIMZXDS7JFE6B67THAK9T3FY3XCSNUR` (for reference, though manual verification doesn't require it)
