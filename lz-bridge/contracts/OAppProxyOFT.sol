// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OApp Proxy OFT
 * @notice Wraps standard USDC token for LayerZero cross-chain bridging
 * @dev Extends OFTAdapter to wrap existing ERC20 tokens (like Circle's USDC) for LayerZero V2 OFT functionality.
 *      This allows bridging standard USDC instead of a custom token.
 *
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
import {OFTAdapter} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";

/**
 * @dev OAppProxyOFT wraps an existing ERC20 token (standard USDC) to enable LayerZero cross-chain transfers.
 *      Users must approve this contract to spend their USDC before bridging.
 *      
 *      On Base Sepolia: Wraps Circle's USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
 *      On Story Aeneid: Wraps a wrapped USDC token (deploy a wrapped USDC or use existing)
 *      
 *      Note: Ownable is already inherited via OFTAdapter -> OFTCore -> OApp -> OAppCore -> Ownable
 */
contract OAppProxyOFT is OFTAdapter {
    /**
     * @dev Constructor for OAppProxyOFT
     * @param _token The address of the ERC20 token to wrap (e.g., standard USDC)
     * @param _lzEndpoint The LayerZero endpoint address
     * @param _delegate The delegate capable of making OApp configurations (also becomes owner)
     */
    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) {
        require(_token != address(0), "OAppProxyOFT: Token cannot be zero");
        require(_lzEndpoint != address(0), "OAppProxyOFT: Endpoint cannot be zero");
        require(_delegate != address(0), "OAppProxyOFT: Delegate cannot be zero");
    }
}
