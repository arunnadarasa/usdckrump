// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroEndpointV2, MessagingParams, MessagingFee } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import { ISendLib, Packet } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";

/**
 * @title QuoteTracerV2
 * @notice Enhanced tracer to isolate exactly where quote() fails
 */
contract QuoteTracerV2 {
    ILayerZeroEndpointV2 public endpoint;
    ISendLib public sendLib;

    event LogStep(string step, bool success, bytes data);
    event LogUlnConfig(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold);
    event LogExecutorConfig(address executor, uint32 maxMessageSize);
    event LogDVNFee(address dvn, uint256 fee);
    event LogExecutorFee(address executor, uint256 fee);
    event LogTreasuryFee(uint256 nativeFee, uint256 lzTokenFee);
    event LogFinalResult(bool success, uint256 nativeFee, uint256 lzTokenFee);

    constructor(address _endpoint, address _sendLib) {
        endpoint = ILayerZeroEndpointV2(_endpoint);
        sendLib = ISendLib(_sendLib);
    }

    function traceQuoteDetailed(
        MessagingParams calldata _params,
        address _sender
    ) external {
        // Step 1: Get send library
        try endpoint.getSendLibrary(_sender, _params.dstEid) returns (address lib) {
            emit LogStep("getSendLibrary", true, abi.encode(lib));
        } catch (bytes memory reason) {
            emit LogStep("getSendLibrary", false, reason);
            return;
        }

        // Step 2: Get ULN config
        try sendLib.getConfig(_params.dstEid, _sender, 2) returns (bytes memory configBytes) {
            (
                uint64 confirmations,
                uint8 requiredDVNCount,
                uint8 optionalDVNCount,
                uint8 optionalDVNThreshold,
                address[] memory requiredDVNs,
                address[] memory optionalDVNs
            ) = abi.decode(configBytes, (uint64, uint8, uint8, uint8, address[], address[]));
            emit LogUlnConfig(confirmations, requiredDVNCount, optionalDVNCount, optionalDVNThreshold);
            
            // Step 3: Test DVN.getFee() for each DVN
            if (optionalDVNs.length > 0) {
                address dvn = optionalDVNs[0];
                try this.testDVNGetFee(dvn, _params.dstEid, confirmations, _sender) returns (uint256 fee) {
                    emit LogDVNFee(dvn, fee);
                } catch (bytes memory reason) {
                    emit LogStep("DVN.getFee", false, reason);
                    return;
                }
            }
        } catch (bytes memory reason) {
            emit LogStep("getUlnConfig", false, reason);
            return;
        }

        // Step 4: Get executor config
        try sendLib.getConfig(_params.dstEid, _sender, 1) returns (bytes memory configBytes) {
            (uint32 maxMessageSize, address executor) = abi.decode(configBytes, (uint32, address));
            emit LogExecutorConfig(executor, maxMessageSize);
            
            // Step 5: Test executor.getFee()
            if (executor != address(0)) {
                try this.testExecutorGetFee(executor, _params.dstEid, _sender, 0) returns (uint256 fee) {
                    emit LogExecutorFee(executor, fee);
                } catch (bytes memory reason) {
                    emit LogStep("Executor.getFee", false, reason);
                    return;
                }
            }
        } catch (bytes memory reason) {
            emit LogStep("getExecutorConfig", false, reason);
            return;
        }

        // Step 6: Try full quote()
        try endpoint.quote(_params, _sender) returns (MessagingFee memory fee) {
            emit LogFinalResult(true, fee.nativeFee, fee.lzTokenFee);
        } catch (bytes memory reason) {
            emit LogStep("quote()", false, reason);
            emit LogFinalResult(false, 0, 0);
        }
    }

    function testDVNGetFee(
        address _dvn,
        uint32 _dstEid,
        uint64 _confirmations,
        address _sender
    ) external view returns (uint256) {
        // ILayerZeroDVN interface
        (bool success, bytes memory result) = _dvn.staticcall(
            abi.encodeWithSignature(
                "getFee(uint32,uint64,address,bytes)",
                _dstEid,
                _confirmations,
                _sender,
                ""
            )
        );
        require(success, "DVN.getFee failed");
        return abi.decode(result, (uint256));
    }

    function testExecutorGetFee(
        address _executor,
        uint32 _dstEid,
        address _sender,
        uint256 _calldataSize
    ) external view returns (uint256) {
        // ILayerZeroExecutor interface
        (bool success, bytes memory result) = _executor.staticcall(
            abi.encodeWithSignature(
                "getFee(uint32,address,uint256,bytes)",
                _dstEid,
                _sender,
                _calldataSize,
                ""
            )
        );
        require(success, "Executor.getFee failed");
        return abi.decode(result, (uint256));
    }
}
