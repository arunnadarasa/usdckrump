# Manual Verification Instructions - Story Aeneid USDCKrumpOFT

## Contract Details

**Contract Address**: `0x6c8Ee63E204857EA3936679CA20dC4e9Fa60E76c`  
**Network**: Story Aeneid (Chain ID: 1315)  
**Explorer**: https://aeneid.storyscan.io  
**Contract Name**: USDCKrumpOFT  
**Source File**: `contracts/USDCKrumpOFT.sol`

## Constructor Arguments

The constructor takes 3 parameters:
1. `_endpoint`: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4`
2. `_delegate`: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25`
3. `_backend`: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25`

## ABI-Encoded Constructor Arguments

**ABI-Encoded Constructor Arguments**:
```
0x000000000000000000000000db09c62692b837c6bd8e53df33957e5f018a68b400000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a2500000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25
```

Or as comma-separated addresses:
```
0xdB09C62692B837C6bd8E53dF33957E5f018A68B4,0x35df28Db852f528282Dd26AAa0C3968aac1d3a25,0x35df28Db852f528282Dd26AAa0C3968aac1d3a25
```

## Manual Verification Steps

1. **Go to StoryScan**: https://aeneid.storyscan.io/address/0x6c8Ee63E204857EA3936679CA20dC4e9Fa60E76c#code

2. **Click "Verify and Publish"** (if not already verified)

3. **Select Verification Method**:
   - **Standard JSON Input** (recommended)
   - Or **Solidity (Standard JSON Input)**

4. **Enter Contract Details**:
   - **Contract Name**: `USDCKrumpOFT`
   - **Compiler Version**: `0.8.20` (with optimizer enabled, runs: 200, viaIR: true)
   - **Source Code**: Copy the entire content of `contracts/USDCKrumpOFT.sol`

5. **Constructor Arguments**:
   - **ABI-Encoded** (recommended):
     ```
     0x000000000000000000000000db09c62692b837c6bd8e53df33957e5f018a68b400000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a2500000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25
     ```
   - **OR as comma-separated addresses**:
     ```
     0xdB09C62692B837C6bd8E53dF33957E5f018A68B4,0x35df28Db852f528282Dd26AAa0C3968aac1d3a25,0x35df28Db852f528282Dd26AAa0C3968aac1d3a25
     ```

6. **Optimization**: Yes, 200 runs

7. **EVM Version**: Default (or Paris if available)

8. **Submit** and wait for verification

## Alternative: Use Hardhat Flatten

If StoryScan requires flattened source code:

```bash
npx hardhat flatten contracts/USDCKrumpOFT.sol > usdckrump-story-flattened.sol
```

Then upload the flattened file to StoryScan.

## Verification Status

After successful verification, the contract will show:
- ✅ Verified source code
- ✅ Read/Write contract functions available
- ✅ Contract ABI visible

## Contract URL

Once verified: https://aeneid.storyscan.io/address/0x6c8Ee63E204857EA3936679CA20dC4e9Fa60E76c#code
