# Instructions for Redeploying EndpointV2 with Different Compiler Settings

## Problem
The deployed EndpointV2 contract has a bug where internal calls to `getSendLibrary()` fail to read mapping storage correctly, causing `LZ_DefaultSendLibUnavailable()` errors.

## Hypothesis
The bug might be caused by compiler optimization or `viaIR` settings. Testing different compiler configurations may resolve the issue.

## Steps to Test Different Compiler Settings

### Option 1: Disable Optimization

1. **Modify `hardhat.config.js`:**
   ```javascript
   optimizer: { 
     enabled: false,  // Changed from true
     runs: 200 
   },
   ```

2. **Clean and recompile:**
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

3. **Redeploy:**
   ```bash
   npx hardhat run scripts/redeploy-endpoint-different-settings.js --network baseSepolia
   ```

4. **Configure and test:**
   ```bash
   npx hardhat run scripts/configure-own-endpoint-libraries.js --network baseSepolia
   npx hardhat run scripts/set-oapp-send-library.js --network baseSepolia
   npx hardhat run scripts/test-lz-oft-send.js --network baseSepolia
   ```

### Option 2: Disable viaIR

1. **Modify `hardhat.config.js`:**
   ```javascript
   viaIR: false  // Changed from true
   ```

2. **Clean and recompile:**
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

3. **Redeploy and test** (same as Option 1, steps 3-4)

### Option 3: Different Solidity Version

1. **Modify `hardhat.config.js`:**
   ```javascript
   version: "0.8.19",  // or "0.8.21"
   ```

2. **Clean and recompile:**
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

3. **Redeploy and test** (same as Option 1, steps 3-4)

### Option 4: Both No Optimization AND No viaIR

1. **Modify `hardhat.config.js`:**
   ```javascript
   optimizer: { 
     enabled: false,
     runs: 200 
   },
   viaIR: false
   ```

2. **Clean, recompile, redeploy, and test**

## After Successful Redeployment

If `quote()` works with new compiler settings:

1. **Verify the contract on Etherscan:**
   ```bash
   npx hardhat verify --network baseSepolia <NEW_ENDPOINT_ADDRESS> 84532 <OWNER_ADDRESS>
   ```

2. **Update all references:**
   - Update `deployments/base-sepolia-own-latest.json`
   - Update frontend config if needed
   - Update any scripts that reference the old endpoint

3. **Document the fix:**
   - Note which compiler settings fixed the issue
   - Update deployment documentation

## If All Options Fail

If none of the compiler setting changes fix the issue:

1. **Contact LayerZero Support** with:
   - `CRITICAL_BUG_REPORT.md`
   - Contract addresses
   - Test results
   - Compiler settings tested

2. **Check LayerZero GitHub:**
   - Search for similar issues
   - Check if there's a known fix
   - Consider updating to latest LayerZero contracts

3. **Alternative: Use LayerZero's Official Endpoint**
   - If available, use LayerZero's deployed endpoint instead
   - This avoids the bug entirely

## Current Compiler Settings (Causing Bug)
- Solidity: 0.8.20
- Optimizer: Enabled (200 runs)
- viaIR: true

## Recommended Test Order
1. Try Option 4 first (no optimization + no viaIR) - most likely to fix
2. Try Option 1 (no optimization)
3. Try Option 2 (no viaIR)
4. Try Option 3 (different Solidity version)
