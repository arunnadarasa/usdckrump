// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroExecutor } from "./layerzero-infra/messagelib/interfaces/ILayerZeroExecutor.sol";

/**
 * @title SimpleExecutor
 * @notice Simple executor that returns 0 fee for testing purposes
 */
contract SimpleExecutor is ILayerZeroExecutor {
    function getFee(
        uint32 /*_dstEid*/,
        address /*_sender*/,
        uint256 /*_calldataSize*/,
        bytes calldata /*_options*/
    ) external pure override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
    
    function assignJob(
        uint32 /*_dstEid*/,
        address /*_sender*/,
        uint256 /*_calldataSize*/,
        bytes calldata /*_options*/
    ) external pure override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
}
