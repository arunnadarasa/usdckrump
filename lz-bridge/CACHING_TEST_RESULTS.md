# Send Library Caching Test Results

## Test Summary

**Date**: February 20, 2026  
**Network**: Base Sepolia  
**Endpoint**: `0x062b604dDE10b4e143696063BF1F6dd860200508`  
**OApp**: `0x7479Ea5C9461b886b7b8644C1E332e6889c7dD63`  
**EID**: 1315 (Story Aeneid)

## Key Findings

### 1. View Function Returns Incorrect Value

- **`getSendLibrary()`**: Returns `0` (address zero)
- **`isDefaultSendLibrary()`**: Returns `false`
- **`defaultSendLibrary(1315)`**: Returns correct address `0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355`

### 2. Storage Contradiction

- **`setSendLibrary()`**: Returns `LZ_SameValue` error
  - This means the library IS already set to the value we're trying to set
  - The storage check confirms the library is stored correctly
  
- **`getSendLibrary()`**: Returns `0`
  - Cannot read back the stored value
  - Suggests a storage slot mismatch or view function bug

### 3. Execution Behavior

- **`quoteSend()`**: Fails with `LZ_DefaultSendLibUnavailable`
  - Confirms that during actual execution, `getSendLibrary()` also returns `0`
  - The bug affects both view functions AND execution

### 4. Caching Test Results

**Test 1: Without block tag (may use cache)**
- `getSendLibrary()`: `0` ❌
- `isDefaultSendLibrary()`: `false`

**Test 2: With explicit block tag (bypasses cache)**
- `getSendLibrary()`: `0` ❌
- Still returns `0` even with explicit block tag
- **Conclusion**: NOT a caching issue

**Test 3: After waiting 5 blocks**
- `getSendLibrary()`: `0` ❌
- Still returns `0` after blocks pass
- **Conclusion**: NOT a timing/block issue

## Root Cause Analysis

The issue is **NOT** a caching problem. The evidence suggests:

1. **Storage is set correctly** (confirmed by `LZ_SameValue` error)
2. **View function cannot read it back** (`getSendLibrary()` returns `0`)
3. **Execution also fails** (`quoteSend()` fails with `LZ_DefaultSendLibUnavailable`)

### Possible Causes

1. **Storage Slot Mismatch**
   - `setSendLibrary` writes to one storage slot
   - `getSendLibrary` reads from a different storage slot
   - Could be due to contract upgrade or storage layout change

2. **View Function Bug**
   - The `getSendLibrary()` implementation might have a bug
   - Could be reading from wrong mapping or using wrong key

3. **OApp Address Mismatch**
   - Library might be set for a different OApp address
   - But `LZ_SameValue` suggests it IS set for the correct address

4. **Contract Implementation Issue**
   - The EndpointV2 contract might have a bug
   - Or there's a proxy/upgrade issue causing storage mismatch

## Recommendations

1. **Check EndpointV2 Source Code**
   - Verify `getSendLibrary()` implementation
   - Check if there's a known bug or issue

2. **Try Clearing and Resetting**
   - Set library to `DEFAULT_LIB` (address(0)) first
   - Then set it to the actual library address

3. **Check for Proxy/Upgrade**
   - Verify if EndpointV2 is a proxy contract
   - Check if storage layout changed during upgrade

4. **Contact LayerZero Support**
   - This appears to be a bug in the EndpointV2 contract
   - LayerZero team should be notified

## Current Status

- ❌ View function returns incorrect value
- ❌ Execution fails due to library resolution
- ✅ Storage appears to be set (based on `LZ_SameValue`)
- ✅ Default library is configured correctly
- ✅ SendUln302 supports EID 1315
- ✅ Library is registered

## Next Steps

1. Investigate EndpointV2 contract source code
2. Try clearing library storage and resetting
3. Check if there's a workaround or fix available
4. Consider using a different endpoint or library configuration method
