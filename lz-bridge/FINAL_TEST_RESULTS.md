# Final Test Results: EndpointV2 Internal Call Bug

## Test Summary

### Test 1: Original Deployment (Optimizer: 200 runs, viaIR: true)
- **Result**: ❌ Bug present
- **Endpoint**: `0x062b604dDE10b4e143696063BF1F6dd860200508`
- **Issue**: Internal calls to `getSendLibrary()` fail

### Test 2: Minimal Optimization (Optimizer: 1 run, viaIR: true)
- **Result**: ❌ Bug persists
- **Endpoint**: `0xD5425A632A32FEA2d5bD67DBF7ae7C002bCF125b`
- **Issue**: Same bug - internal calls still fail

## Conclusion

**The bug is NOT caused by compiler optimization level.**

Even with minimal optimization (1 run instead of 200), the internal call bug persists. This suggests:

1. **The issue is NOT compiler optimization** - Changing from 200 runs to 1 run didn't fix it
2. **The issue might be fundamental** - Could be:
   - A bug in Solidity 0.8.20's handling of internal calls to nested mappings
   - A bug in LayerZero's EndpointV2 contract implementation
   - A bug in how viaIR compiles internal calls
   - A storage layout issue that's not compiler-related

## What We've Tested

✅ External `getSendLibrary()` calls - Work correctly  
✅ Storage is set correctly - Confirmed by `LZ_SameValue`  
✅ Static calls work - `getSendLibrary.staticCall()` works  
✅ Default library is set - `defaultSendLibrary()` works externally  
❌ Internal calls from `quote()` - Fail consistently  
❌ Minimal optimization - Doesn't fix the bug  
❌ Reset to DEFAULT_LIB - Still fails internally  

## Next Steps

Since compiler settings don't fix the issue:

1. **Contact LayerZero Support** - This appears to be a bug in their contract
2. **Check LayerZero GitHub** - Search for similar issues or known bugs
3. **Consider Using Official Endpoint** - If LayerZero provides an official endpoint, use that instead
4. **Wait for LayerZero Fix** - This may require a contract update from LayerZero

## Test Scripts Used

- `test-new-endpoint-quote.js` - Tests new endpoint with minimal optimization
- `test-internal-vs-external-call.js` - Demonstrates the bug
- `test-reset-to-default-workaround.js` - Tests workarounds

## Deployed Contracts

### Original (Bug Present)
- EndpointV2: `0x062b604dDE10b4e143696063BF1F6dd860200508`
- Compiler: 0.8.20, Optimizer: 200 runs, viaIR: true

### New (Bug Still Present)
- EndpointV2: `0xD5425A632A32FEA2d5bD67DBF7ae7C002bCF125b`
- Compiler: 0.8.20, Optimizer: 1 run, viaIR: true

Both deployments exhibit the same bug, confirming it's not related to optimization level.
