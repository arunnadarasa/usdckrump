// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ILayerZeroDVN } from "./layerzero-infra/messagelib/uln/interfaces/ILayerZeroDVN.sol";

/**
 * @title SimpleDVN
 * @notice Simple DVN that implements ILayerZeroDVN for testing
 * @dev Returns 0 fee for all quote() calls
 */
contract SimpleDVN is ILayerZeroDVN {
    function getFee(
        uint32 /*_dstEid*/,
        uint64 /*_confirmations*/,
        address /*_sender*/,
        bytes calldata /*_options*/
    ) external pure override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
    
    function assignJob(
        AssignJobParam calldata /*_param*/,
        bytes calldata /*_options*/
    ) external payable override returns (uint256) {
        return 0; // Return 0 fee for testing
    }
}
