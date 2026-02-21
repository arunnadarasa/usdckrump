# Verify OAppProxyOFT on Base Sepolia

## Contract Details

- **Address**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- **BaseScan**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

## Constructor Arguments

```json
[
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"
]
```

**ABI-encoded**:
```
0x000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e0000000000000000000000006edce65403992e310a62460808c4b910d972f10f00000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25
```

## Manual Verification Steps

1. **Go to**: https://sepolia.basescan.org/address/0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627#code

2. **Click**: "Verify and Publish" button

3. **Select**: "Via Standard JSON Input"

4. **Compiler Version**: `0.8.20`

5. **Optimization**: 
   - ✅ Yes
   - Runs: `1`
   - ✅ Enable viaIR

6. **Standard JSON Input**: 
   - Get from: `artifacts/build-info/` directory
   - Look for file containing `OAppProxyOFT`

7. **Constructor Arguments**: 
   ```
   ["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x6EDCE65403992e310A62460808c4b910D972f10f","0x35df28Db852f528282Dd26AAa0C3968aac1d3a25"]
   ```

8. **Click**: "Verify and Publish"

## Automated Verification

If you have Etherscan API V2 key:

```bash
# Update .env with Etherscan API key
ETHERSCAN_API_KEY=your_api_key_here

# Run verification
npm run verify:proxy-oft-base
```

## Get Standard JSON Input

```bash
# Compile contracts
npm run build

# Standard JSON will be in:
# artifacts/build-info/[hash].json
```

Or generate flattened contract:

```bash
npx hardhat flatten contracts/OAppProxyOFT.sol > OAppProxyOFT-flattened.sol
```

Then use "Via flattened source code" option instead.
