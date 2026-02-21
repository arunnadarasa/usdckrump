# OAppProxyOFT Deployment Status

## ✅ Successfully Deployed

### 1. Wrapped USDC (Story Aeneid)
- **Address**: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4`
- **Network**: Story Aeneid (Chain ID: 1315)
- **Status**: ✅ Deployed
- **Deployment File**: `deployments/wrapped-usdc-storyAeneid-latest.json`

### 2. OAppProxyOFT (Base Sepolia)
- **Address**: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Wrapped Token**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle's USDC)
- **Endpoint**: `0x6EDCE65403992e310A62460808c4b910D972f10f` (Official LayerZero)
- **Status**: ✅ Deployed
- **Deployment File**: `deployments/oapp-proxy-oft-baseSepolia-latest.json`

### 3. OAppProxyOFT (Story Aeneid)
- **Address**: `0xB635b0Ad94D0995f166cbd9498832101cdda8508`
- **Network**: Story Aeneid (Chain ID: 1315)
- **Wrapped Token**: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4` (WrappedUSDC)
- **Endpoint**: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4` (Self-deployed)
- **Status**: ✅ Deployed
- **Deployment File**: `deployments/oapp-proxy-oft-storyAeneid-latest.json`

### 4. Peer Linking
- **Base Sepolia → Story Aeneid**: ✅ Peer set
- **Story Aeneid → Base Sepolia**: ✅ Peer set
- **Status**: ✅ Linked

## ⚠️ Pending Configuration

### Library Configuration
The LayerZero library configuration needs to be completed. This requires:

1. **Base Sepolia Libraries**:
   - SendUln302: `0xC1868e054425D378095A003EcbA3823a5D0135C9` (Official)
   - ReceiveUln302: `0x12523de19dc41c91F7d2093E0CFbB76b17012C8d` (Official)

2. **Story Aeneid Libraries**:
   - SendUln302: `0xB00b22e8D0E8840B979B899Eb125b5db3C0E4aA2` (Self-deployed)
   - ReceiveUln302: `0xbcBe64F771027571573e88750BE19F487e9c9F68` (Self-deployed)

**Issue**: Library configuration failed due to permissions. The endpoint may require:
- The OAppProxyOFT contract to be set as delegate
- Or manual configuration via endpoint owner

## 📝 Next Steps

### Option 1: Configure via Endpoint Owner
If you have access to the endpoint owner account:

```bash
# On Base Sepolia endpoint (0x6EDCE65403992e310A62460808c4b910D972f10f)
endpoint.setSendLibrary(
  OAppProxyOFT,  # 0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627
  dstEid,        # 1315 (Story Aeneid)
  sendLib        # 0xC1868e054425D378095A003EcbA3823a5D0135C9
);

endpoint.setReceiveLibrary(
  OAppProxyOFT,  # 0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627
  srcEid,        # 40245 (Base Sepolia)
  receiveLib,    # 0x12523de19dc41c91F7d2093E0CFbB76b17012C8d
  0              # grace period
);

# On Story Aeneid endpoint (0xdB09C62692B837C6bd8E53dF33957E5f018A68B4)
endpoint.setSendLibrary(
  OAppProxyOFT,  # 0xB635b0Ad94D0995f166cbd9498832101cdda8508
  dstEid,        # 40245 (Base Sepolia)
  sendLib        # 0xB00b22e8D0E8840B979B899Eb125b5db3C0E4aA2
);

endpoint.setReceiveLibrary(
  OAppProxyOFT,  # 0xB635b0Ad94D0995f166cbd9498832101cdda8508
  srcEid,        # 1315 (Story Aeneid)
  receiveLib,    # 0xbcBe64F771027571573e88750BE19F487e9c9F68
  0              # grace period
);
```

### Option 2: Set Delegate
If OAppProxyOFT should configure itself, ensure it's set as delegate:

```bash
# On Base Sepolia
endpoint.setDelegate(OAppProxyOFT, true);

# On Story Aeneid  
endpoint.setDelegate(OAppProxyOFT, true);
```

## 🧪 Testing

Once libraries are configured, test the bridge:

```bash
npm run test:proxy-oft -- --network baseSepolia
```

## 📊 Summary

| Component | Status |
|-----------|--------|
| Wrapped USDC (Story Aeneid) | ✅ Deployed |
| OAppProxyOFT (Base Sepolia) | ✅ Deployed |
| OAppProxyOFT (Story Aeneid) | ✅ Deployed |
| Peer Linking | ✅ Complete |
| Library Configuration | ⚠️ Pending |

## 🔗 Contract Addresses

**Base Sepolia:**
- OAppProxyOFT: `0xcaC4f1Bd5A05123Fe65aD64112d44D7aDd0D6627`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Endpoint: `0x6EDCE65403992e310A62460808c4b910D972f10f`

**Story Aeneid:**
- OAppProxyOFT: `0xB635b0Ad94D0995f166cbd9498832101cdda8508`
- WrappedUSDC: `0x7d3E90a670400465f84c0892DF9a4f2bE2d168a4`
- Endpoint: `0xdB09C62692B837C6bd8E53dF33957E5f018A68B4`

---

**Deployment Date**: February 20, 2026  
**Deployer**: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25`
