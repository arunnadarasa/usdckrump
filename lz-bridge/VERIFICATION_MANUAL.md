# Manual Verification Instructions - EndpointV2 Infrastructure & USDCKrumpOFT

**Network**: Base Sepolia (Chain ID: 84532)  
**Block Explorer**: https://sepolia.basescan.org

---

## 📋 Contracts to Verify

### 1. EndpointV2
- **Address**: `0x062b604dDE10b4e143696063BF1F6dd860200508`
- **Contract**: `contracts/layerzero-infra/protocol/EndpointV2.sol:EndpointV2`
- **Constructor Args**:
  - `_eid`: `84532` (uint32)
  - `_owner`: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25` (address)
- **ABI-encoded**: `0000000000000000000000000000000000000000000000000000000000014a3400000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25`
- **Verification URL**: https://sepolia.basescan.org/verifyContract?a=0x062b604dDE10b4e143696063BF1F6dd860200508

### 2. SendUln302
- **Address**: `0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355`
- **Contract**: `contracts/layerzero-infra/messagelib/uln/uln302/SendUln302.sol:SendUln302`
- **Constructor Args**:
  - `_endpoint`: `0x062b604dDE10b4e143696063BF1F6dd860200508` (address)
  - `_treasuryGasLimit`: `50000` (uint256)
  - `_treasuryGasForFeeCap`: `1000000000000000000` (uint256, 1 ETH)
- **ABI-encoded**: `000000000000000000000000062b604dde10b4e143696063bf1f6dd860200508000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000000000000000000000000000de0b6b3a7640000`
- **Verification URL**: https://sepolia.basescan.org/verifyContract?a=0x97d1ed237b4f56086689B6F54Ce8b37bFBf38355

### 3. ReceiveUln302
- **Address**: `0x008e6069dD1350ff4D9460C79B7Ec3f839eE6f77`
- **Contract**: `contracts/layerzero-infra/messagelib/uln/uln302/ReceiveUln302.sol:ReceiveUln302`
- **Constructor Args**:
  - `_endpoint`: `0x062b604dDE10b4e143696063BF1F6dd860200508` (address)
- **ABI-encoded**: `000000000000000000000000062b604dde10b4e143696063bf1f6dd860200508`
- **Verification URL**: https://sepolia.basescan.org/verifyContract?a=0x008e6069dD1350ff4D9460C79B7Ec3f839eE6f77

### 4. USDCKrumpOFT (Redeployed)
- **Address**: `0xACb294d6EB0544D968bd383F88255Cd850b0076b`
- **Contract**: `contracts/USDCKrumpOFT.sol:USDCKrumpOFT`
- **Constructor Args**:
  - `_endpoint`: `0x062b604dDE10b4e143696063BF1F6dd860200508` (address)
  - `_delegate`: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25` (address)
  - `_backend`: `0x35df28Db852f528282Dd26AAa0C3968aac1d3a25` (address)
- **ABI-encoded**: `000000000000000000000000062b604dde10b4e143696063bf1f6dd86020050800000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a2500000000000000000000000035df28db852f528282dd26aaa0c3968aac1d3a25`
- **Verification URL**: https://sepolia.basescan.org/verifyContract?a=0xACb294d6EB0544D968bd383F88255Cd850b0076b

---

## 🔧 Compiler Settings

- **Solidity Version**: `0.8.20`
- **Optimizer**: Enabled
- **Runs**: `200`
- **Via-IR**: Yes

---

## 📝 Manual Verification Steps

1. **Get Etherscan API V2 Key**:
   - Visit: https://docs.etherscan.io/v2-migration
   - Create/get your API V2 key
   - Update `.env` with `ETHERSCAN_API_KEY=<your-v2-key>`

2. **Or use Manual Verification**:
   - Open the verification URL for each contract
   - Select "Via Standard JSON Input" or "Via Flattened Source"
   - Use compiler settings above
   - Paste the ABI-encoded constructor arguments
   - Submit

3. **Using Hardhat (after updating API key)**:
   ```bash
   # Verify infrastructure
   npx hardhat run scripts/verify-endpoint-infra-base.js --network baseSepolia
   
   # Verify USDCKrumpOFT
   npx hardhat run scripts/verify-oft-krump-base.js --network baseSepolia
   ```

---

## ✅ Verification Status

- ⏳ **EndpointV2**: Pending (requires API V2 key)
- ⏳ **SendUln302**: Pending (requires API V2 key)
- ⏳ **ReceiveUln302**: Pending (requires API V2 key)
- ⏳ **USDCKrumpOFT**: Pending (requires API V2 key)

---

**Note**: All contracts are deployed and functional. Verification is for transparency and block explorer visibility only.
