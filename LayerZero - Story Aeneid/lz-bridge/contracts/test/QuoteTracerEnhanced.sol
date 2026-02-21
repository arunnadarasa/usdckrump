// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroEndpointV2, MessagingParams, MessagingFee } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import { ISendLib, Packet } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";

/**
 * @title QuoteTracerEnhanced
 * @notice Enhanced tracer with detailed step-by-step logging to isolate quote() failures
 */
contract QuoteTracerEnhanced {
    ILayerZeroEndpointV2 public endpoint;
    ISendLib public sendLib;

    event LogStep(string step, bool success, bytes data, uint256 timestamp);
    event LogUlnConfig(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] optionalDVNs);
    event LogExecutorConfig(address executor, uint32 maxMessageSize);
    event LogMessageSize(uint256 messageSize, uint32 maxMessageSize);
    event LogDVNFee(address dvn, uint256 fee, bool success);
    event LogExecutorFee(address executor, uint256 fee, bool success);
    event LogOptionsDecode(bytes options, uint256 optionsLength, bool success);
    event LogFinalResult(bool success, uint256 nativeFee, uint256 lzTokenFee, bytes errorData);

    constructor(address _endpoint, address _sendLib) {
        endpoint = ILayerZeroEndpointV2(_endpoint);
        sendLib = ISendLib(_sendLib);
    }

    function traceQuoteDetailed(
        MessagingParams calldata _params,
        address _sender
    ) external {
        uint256 startTime = block.timestamp;
        
        // Step 1: Get send library
        emit LogStep("1_getSendLibrary_start", true, "", startTime);
        address lib;
        try endpoint.getSendLibrary(_sender, _params.dstEid) returns (address _lib) {
            lib = _lib;
            emit LogStep("1_getSendLibrary_success", true, abi.encode(lib), block.timestamp);
        } catch (bytes memory reason) {
            emit LogStep("1_getSendLibrary_failed", false, reason, block.timestamp);
            emit LogFinalResult(false, 0, 0, reason);
            return;
        }

        // Step 2: Check message size
        emit LogStep("2_checkMessageSize_start", true, "", block.timestamp);
        uint256 messageSize = _params.message.length;
        try sendLib.getConfig(_params.dstEid, _sender, 1) returns (bytes memory executorConfigBytes) {
            (uint32 maxMessageSize, address executor) = abi.decode(executorConfigBytes, (uint32, address));
            emit LogMessageSize(messageSize, maxMessageSize);
            if (messageSize > maxMessageSize) {
                emit LogStep("2_checkMessageSize_failed", false, abi.encode("Message too large"), block.timestamp);
                emit LogFinalResult(false, 0, 0, abi.encode("Message size exceeds max"));
                return;
            }
            emit LogStep("2_checkMessageSize_success", true, "", block.timestamp);
        } catch (bytes memory reason) {
            emit LogStep("2_checkMessageSize_error", false, reason, block.timestamp);
        }

        // Step 3: Decode options
        emit LogStep("3_decodeOptions_start", true, "", block.timestamp);
        emit LogOptionsDecode(_params.options, _params.options.length, true);
        emit LogStep("3_decodeOptions_success", true, "", block.timestamp);

        // Step 4: Get ULN config
        emit LogStep("4_getUlnConfig_start", true, "", block.timestamp);
        try sendLib.getConfig(_params.dstEid, _sender, 2) returns (bytes memory configBytes) {
            (
                uint64 confirmations,
                uint8 requiredDVNCount,
                uint8 optionalDVNCount,
                uint8 optionalDVNThreshold,
                address[] memory requiredDVNs,
                address[] memory optionalDVNs
            ) = abi.decode(configBytes, (uint64, uint8, uint8, uint8, address[], address[]));
            emit LogUlnConfig(confirmations, requiredDVNCount, optionalDVNCount, optionalDVNThreshold, optionalDVNs);
            emit LogStep("4_getUlnConfig_success", true, "", block.timestamp);
            
            // Step 5: Test DVN.getFee() for each DVN
            emit LogStep("5_testDVNFees_start", true, "", block.timestamp);
            uint8 dvnsLength = requiredDVNCount + optionalDVNCount;
            for (uint8 i = 0; i < dvnsLength; ++i) {
                address dvn = i < requiredDVNCount
                    ? requiredDVNs[i]
                    : optionalDVNs[i - requiredDVNCount];
                
                try this.testDVNGetFee(dvn, _params.dstEid, confirmations, _sender) returns (uint256 fee) {
                    emit LogDVNFee(dvn, fee, true);
                } catch (bytes memory reason) {
                    emit LogDVNFee(dvn, 0, false);
                    emit LogStep("5_testDVNFees_failed", false, abi.encodePacked(abi.encode(dvn), reason), block.timestamp);
                    emit LogFinalResult(false, 0, 0, reason);
                    return;
                }
            }
            emit LogStep("5_testDVNFees_success", true, "", block.timestamp);
        } catch (bytes memory reason) {
            emit LogStep("4_getUlnConfig_failed", false, reason, block.timestamp);
            emit LogFinalResult(false, 0, 0, reason);
            return;
        }

        // Step 6: Get executor config
        emit LogStep("6_getExecutorConfig_start", true, "", block.timestamp);
        try sendLib.getConfig(_params.dstEid, _sender, 1) returns (bytes memory executorConfigBytes) {
            (uint32 maxMessageSize, address executor) = abi.decode(executorConfigBytes, (uint32, address));
            emit LogExecutorConfig(executor, maxMessageSize);
            emit LogStep("6_getExecutorConfig_success", true, "", block.timestamp);
            
            // Step 7: Test executor.getFee()
            emit LogStep("7_testExecutorFee_start", true, "", block.timestamp);
            if (executor != address(0)) {
                try this.testExecutorGetFee(executor, _params.dstEid, _sender, messageSize) returns (uint256 fee) {
                    emit LogExecutorFee(executor, fee, true);
                    emit LogStep("7_testExecutorFee_success", true, "", block.timestamp);
                } catch (bytes memory reason) {
                    emit LogExecutorFee(executor, 0, false);
                    emit LogStep("7_testExecutorFee_failed", false, reason, block.timestamp);
                    emit LogFinalResult(false, 0, 0, reason);
                    return;
                }
            } else {
                emit LogStep("7_testExecutorFee_skipped", true, abi.encode("No executor"), block.timestamp);
            }
        } catch (bytes memory reason) {
            emit LogStep("6_getExecutorConfig_failed", false, reason, block.timestamp);
            emit LogFinalResult(false, 0, 0, reason);
            return;
        }

        // Step 8: Try full quote()
        emit LogStep("8_fullQuote_start", true, "", block.timestamp);
        try endpoint.quote(_params, _sender) returns (MessagingFee memory fee) {
            emit LogFinalResult(true, fee.nativeFee, fee.lzTokenFee, "");
            emit LogStep("8_fullQuote_success", true, abi.encode(fee.nativeFee, fee.lzTokenFee), block.timestamp);
        } catch (bytes memory reason) {
            emit LogStep("8_fullQuote_failed", false, reason, block.timestamp);
            emit LogFinalResult(false, 0, 0, reason);
        }
    }

    function testDVNGetFee(
        address _dvn,
        uint32 _dstEid,
        uint64 _confirmations,
        address _sender
    ) external view returns (uint256) {
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
