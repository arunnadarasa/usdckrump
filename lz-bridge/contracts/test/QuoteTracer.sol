// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroEndpointV2, MessagingParams, MessagingFee } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

/**
 * @title QuoteTracer
 * @notice Test contract to trace quote() execution and see where it fails
 */
contract QuoteTracer {
    ILayerZeroEndpointV2 public immutable endpoint;

    event LogGetSendLibrary(address sender, uint32 dstEid, address lib);
    event LogDefaultSendLibrary(uint32 dstEid, address lib);
    event LogIsDefault(bool isDefault);
    event LogQuoteResult(bool success, bytes data);

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpointV2(_endpoint);
    }

    function traceQuote(
        MessagingParams calldata _params,
        address _sender
    ) external {
        uint32 dstEid = _params.dstEid;
        
        // Step 1: Check getSendLibrary()
        address lib = endpoint.getSendLibrary(_sender, dstEid);
        emit LogGetSendLibrary(_sender, dstEid, lib);
        
        // Step 2: Check defaultSendLibrary
        address defaultLib = endpoint.defaultSendLibrary(dstEid);
        emit LogDefaultSendLibrary(dstEid, defaultLib);
        
        // Step 3: Check isDefaultSendLibrary
        bool isDefault = endpoint.isDefaultSendLibrary(_sender, dstEid);
        emit LogIsDefault(isDefault);
        
        // Step 4: Try quote()
        try endpoint.quote(_params, _sender) returns (MessagingFee memory fee) {
            emit LogQuoteResult(true, abi.encode(fee));
        } catch (bytes memory reason) {
            emit LogQuoteResult(false, reason);
        }
    }
}
