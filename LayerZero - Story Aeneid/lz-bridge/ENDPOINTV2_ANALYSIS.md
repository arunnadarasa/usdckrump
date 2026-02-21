# EndpointV2 Source Code Analysis

## Code Review: getSendLibrary vs setSendLibrary

### getSendLibrary Implementation

```solidity
function getSendLibrary(address _sender, uint32 _dstEid) public view returns (address lib) {
    lib = sendLibrary[_sender][_dstEid];
    if (lib == DEFAULT_LIB) {
        lib = defaultSendLibrary[_dstEid];
        if (lib == address(0x0)) revert Errors.LZ_DefaultSendLibUnavailable();
    }
}
```

**Logic:**
1. Read `sendLibrary[_sender][_dstEid]` from storage
2. If it equals `DEFAULT_LIB` (address(0)), resolve to `defaultSendLibrary[_dstEid]`
3. If default is also 0, revert

### setSendLibrary Implementation

```solidity
function setSendLibrary(
    address _oapp,
    uint32 _eid,
    address _newLib
) external onlyRegisteredOrDefault(_newLib) isSendLib(_newLib) onlySupportedEid(_newLib, _eid) {
    _assertAuthorized(_oapp);
    
    // must provide a different value
    if (sendLibrary[_oapp][_eid] == _newLib) revert Errors.LZ_SameValue();
    sendLibrary[_oapp][_eid] = _newLib;
    emit SendLibrarySet(_oapp, _eid, _newLib);
}
```

**Logic:**
1. Check authorization
2. Check if `sendLibrary[_oapp][_eid] == _newLib`
3. If equal, revert with `LZ_SameValue`
4. Otherwise, set `sendLibrary[_oapp][_eid] = _newLib`

### isDefaultSendLibrary Implementation

```solidity
function isDefaultSendLibrary(address _sender, uint32 _dstEid) public view returns (bool) {
    return sendLibrary[_sender][_dstEid] == DEFAULT_LIB;
}
```

## The Contradiction

**Observed Behavior:**
- `setSendLibrary()` → Returns `LZ_SameValue` (library IS set)
- `getSendLibrary()` → Returns `0` (library NOT found)
- `isDefaultSendLibrary()` → Returns `false` (NOT DEFAULT_LIB)

**Analysis:**

If `setSendLibrary` says `LZ_SameValue`, then:
```
sendLibrary[_oapp][_eid] == _newLib  // TRUE
```

But `getSendLibrary` returns `0`, which means:
```
sendLibrary[_sender][_dstEid] == 0  // TRUE (assuming _sender == _oapp, _dstEid == _eid)
```

And `isDefaultSendLibrary` returns `false`, which means:
```
sendLibrary[_sender][_dstEid] != DEFAULT_LIB  // TRUE
```

**This is impossible!** If `sendLibrary[_oapp][_eid] == _newLib` (a non-zero address), then it cannot also equal `0` (DEFAULT_LIB).

## Possible Explanations

### 1. Address Mismatch
- `_oapp` in `setSendLibrary` might be different from `_sender` in `getSendLibrary`
- `_eid` in `setSendLibrary` might be different from `_dstEid` in `getSendLibrary`
- **Check**: Verify we're using the exact same addresses and EIDs

### 2. Storage Slot Collision
- Another contract might be writing to the same storage slot
- Proxy/upgrade might have changed storage layout
- **Check**: Verify EndpointV2 is not a proxy and storage layout hasn't changed

### 3. View Function Bug
- The view function might be reading from wrong storage location
- Compiler optimization bug
- **Check**: Verify bytecode matches source code

### 4. Transaction Reverted But State Changed
- The `setSendLibrary` transaction might have reverted but still changed state
- This shouldn't be possible, but worth checking

### 5. Different Contract Instances
- We might be calling `setSendLibrary` on one contract and `getSendLibrary` on another
- **Check**: Verify we're using the same contract address

## Storage Layout

```solidity
mapping(address sender => mapping(uint32 dstEid => address lib)) internal sendLibrary;
```

This is a nested mapping. The storage slot calculation is:
```
slot = keccak256(abi.encodePacked(keccak256(abi.encode(key1, slot_number)), key2))
```

Where:
- `key1` = sender address
- `key2` = dstEid (uint32)
- `slot_number` = storage slot of `sendLibrary` mapping

## Recommendations

1. **Verify Addresses Match Exactly**
   - Check that OApp address in `setSendLibrary` matches `_sender` in `getSendLibrary`
   - Check that EID matches exactly

2. **Check Contract Address**
   - Verify we're calling the same EndpointV2 contract instance
   - Check if it's a proxy and if so, verify proxy implementation

3. **Read Storage Directly**
   - Use `eth_getStorageAt` to read the storage slot directly
   - Compare with what the view function returns

4. **Check Transaction History**
   - Look at the transaction that set the library
   - Verify it actually succeeded (status == 1)
   - Check if there were any events emitted

5. **Test with Different Values**
   - Try setting library to a different address
   - See if `getSendLibrary` can read that back
   - This will help isolate if it's a read issue or write issue

## Known Issues

After reviewing the source code, I don't see any obvious bugs in the implementation. The logic appears correct. The issue is likely:

1. **Address/EID mismatch** (most likely)
2. **Storage slot collision** (less likely)
3. **Proxy/upgrade issue** (possible if EndpointV2 was upgraded)

## Next Steps

1. Create a script to verify addresses match exactly
2. Read storage slot directly using `eth_getStorageAt`
3. Check transaction history for the `setSendLibrary` call
4. Verify EndpointV2 is not a proxy contract
