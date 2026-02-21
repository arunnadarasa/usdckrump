// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEVVMCore
 * @notice Interface for EVVM Core contract payment functions
 */
interface IEVVMCore {
    function pay(
        address from,
        address to_address,
        string memory to_identity,
        address token,
        uint256 amount,
        uint256 priorityFee,
        address senderExecutor,
        uint256 nonce,
        bool isAsyncExec,
        bytes memory signature
    ) external;
    
    function getNextCurrentSyncNonce(address user) external view returns (uint256);
    function getIfUsedAsyncNonce(address user, uint256 nonce) external view returns (bool);
}
