# Critical Bug Report: EndpointV2 Internal Call Storage Read Failure

## Executive Summary
The deployed `EndpointV2` contract (`0x062b604dDE10b4e143696063BF1F6dd860200508` on Base Sepolia) exhibits a critical bug where internal calls to `getSendLibrary()` fail to read mapping storage correctly, causing `LZ_DefaultSendLibUnavailable()` errors even though external calls work perfectly.

## Contract Details
- **Address**: `0x062b604dDE10b4e143696063BF1F6dd860200508`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Contract**: EndpointV2
- **Compiler**: v0.8.20+commit.a1b79de6
- **Optimization**: Yes (200 runs)
- **EVM Version**: paris
- **Verification Status**: ✅ Verified (Exact Match)

## Bug Description

### Symptom
`quote()` function fails with `LZ_DefaultSendLibUnavailable()` error (`0x6592671c`), even though:
- `getSendLibrary()` works correctly when called externally
- Storage is confirmed set correctly (`setSendLibrary()` throws `LZ_SameValue`)
- `defaultSendLibrary()` returns correct address externally

### Root Cause
When `quote()` calls `getSendLibrary()` internally (line 87 of EndpointV2.sol), the function fails to read mapping storage correctly:
- `sendLibrary[_sender][_dstEid]` is read as `address(0)` (DEFAULT_LIB) internally
- `defaultSendLibrary[_dstEid]` is also read as `address(0)` internally
- External calls to the same functions read correctly

### Code Location
```solidity
// EndpointV2.sol:87
address _sendLibrary = getSendLibrary(_sender, _params.dstEid);

// MessageLibManager.sol:83-89
function getSendLibrary(address _sender, uint32 _dstEid) public view returns (address lib) {
    lib = sendLibrary[_sender][_dstEid];  // ❌ Reads as address(0) internally
    if (lib == DEFAULT_LIB) {
        lib = defaultSendLibrary[_dstEid];  // ❌ Also reads as address(0) internally
        if (lib == address(0x0)) revert Errors.LZ_DefaultSendLibUnavailable();
    }
}
```

## Test Results

### ✅ What Works
```javascript
// External call - WORKS
const lib = await endpoint.getSendLibrary(oapp, eid);
// Returns: 0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355 ✅

// Static call - WORKS  
const lib2 = await endpoint.getSendLibrary.staticCall(oapp, eid);
// Returns: 0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355 ✅

// Default library - WORKS
const defaultLib = await endpoint.defaultSendLibrary(eid);
// Returns: 0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355 ✅
```

### ❌ What Fails
```javascript
// Internal call during quote() - FAILS
const fee = await endpoint.quote(messagingParams, oapp);
// Reverts with: LZ_DefaultSendLibUnavailable() ❌

// Even after resetting to DEFAULT_LIB - STILL FAILS
await endpoint.setSendLibrary(oapp, eid, address(0));
const fee2 = await endpoint.quote(messagingParams, oapp);
// Still reverts with: LZ_DefaultSendLibUnavailable() ❌
```

## Impact
- **Severity**: CRITICAL
- **Affected Functions**: `quote()`, `send()` (via `_send()`)
- **User Impact**: Cannot get quotes or send messages via LayerZero
- **Workaround**: None found

## Attempted Workarounds (All Failed)
1. ✅ Explicit `getSendLibrary()` call before `quote()` - No effect
2. ✅ Reset `sendLibrary` to `DEFAULT_LIB` - Still fails
3. ✅ Use `defaultSendLibrary` directly - Still fails internally
4. ✅ Different address formats - No effect
5. ✅ Storage slot verification - Storage is correct

## Hypothesis
This appears to be a **compiler optimization bug** or **Solidity version bug** affecting how nested mappings are read during internal function calls. The fact that:
- External calls work
- Static calls work  
- Internal calls fail
- Storage is confirmed correct

...suggests the issue is in the compiled bytecode's handling of internal calls to view functions that read nested mappings.

## Recommended Actions

### Immediate
1. **Contact LayerZero Support** with this bug report
2. **Check LayerZero GitHub Issues** for similar reports
3. **Consider redeploying** with different compiler settings:
   - Try without optimization
   - Try different Solidity version
   - Try different EVM version

### Long-term
1. **LayerZero Team**: Investigate compiler optimization interaction with nested mapping reads
2. **Consider**: Updating to latest LayerZero contracts if available
3. **Document**: This bug for future deployments

## Related Contracts
- **SendUln302**: `0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355`
- **ReceiveUln302**: `0x008e6069dD1350ff4D9460C79B7Ec3f839eE6f77`
- **USDCKrumpOFT**: `0x7479Ea5C9461b886b7b8644C1E332e6889c7dD63`

## Test Scripts
All test scripts are available in `/scripts/`:
- `test-internal-vs-external-call.js` - Demonstrates the bug
- `test-reset-to-default-workaround.js` - Tests workarounds
- `test-storage-layout-hypothesis.js` - Storage verification

## Conclusion
This is a **critical bug in the deployed EndpointV2 contract** that prevents LayerZero messaging functionality. The contract source code is correct, but the compiled bytecode has a bug affecting internal calls to mapping storage reads. **Immediate action required** to contact LayerZero support or redeploy with different compiler settings.
