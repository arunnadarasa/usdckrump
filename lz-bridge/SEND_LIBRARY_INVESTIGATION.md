# Send Library Investigation Summary

## Root Cause Found: Decimals Issue ✅

**Problem**: `USDCKrumpOFT` was missing `decimals()` override, defaulting to ERC20's 18 decimals instead of USDC's 6 decimals.

**Impact**: 
- `decimalConversionRate = 10^(18-6) = 10^12 = 1,000,000,000,000`
- `_removeDust(100000) = (100000 / 10^12) * 10^12 = 0`
- Caused `SlippageExceeded(0, 100000)` error

**Fix**: Added `decimals()` override returning 6 in `USDCKrumpOFT.sol` ✅

## Remaining Issue: Send Library Resolution

**Problem**: `getSendLibrary()` returns `0` even though:
- `defaultSendLibrary(1315)` returns correct address ✅
- Per-OApp library is set ✅
- Transactions confirm successfully ✅

**Discovery**: 
- When using explicit block tags, `getSendLibrary()` returns correct address ✅
- This suggests a view function caching issue
- During actual transaction execution, it still fails with `LZ_DefaultSendLibUnavailable()`

**Current State**:
- New OFT deployed: `0x7479Ea5C9461b886b7b8644C1E332e6889c7dD63`
- Libraries configured ✅
- Peers linked ✅
- Tokens minted ✅
- Decimals fixed ✅
- Send library view resolves correctly with block tags ✅
- But actual send/quote still fails ❌

## Next Steps

1. **Wait for more blocks** - The view function caching might resolve after more blocks
2. **Check SendUln302 configuration** - Verify it's properly configured for EID 1315
3. **Test with larger amounts** - See if dust removal works correctly now
4. **Check endpoint's internal quote logic** - May be using different code path than view function

## Files Modified

- `contracts/USDCKrumpOFT.sol` - Added `decimals()` override
- `deployments/usdckrump-base-sepolia-latest.json` - New deployment address

## Test Results

- ✅ Decimals override compiles
- ✅ New OFT deployed successfully
- ✅ Libraries configured
- ✅ Peers linked
- ✅ Tokens minted
- ✅ `getSendLibrary()` resolves with block tags
- ❌ Actual send/quote still fails (view caching issue?)
