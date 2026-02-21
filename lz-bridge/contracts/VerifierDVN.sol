// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IReceiveUlnE2 } from "./layerzero-infra/messagelib/uln/interfaces/IReceiveUlnE2.sol";

/**
 * @title VerifierDVN
 * @notice Small contract that forwards verify() to ReceiveUln302 so PacketVerified can be emitted.
 * @dev Deploy on destination chain (e.g. Story Aeneid). Register this contract as the required
 *      DVN for the receive path (receiver=OApp, srcEid=source chain). Worker watches PacketSent
 *      on source, builds packetHeader/payloadHash, calls submitVerification then commitVerification.
 */
contract VerifierDVN {
    IReceiveUlnE2 public immutable receiveUln;

    constructor(address _receiveUln) {
        receiveUln = IReceiveUlnE2(_receiveUln);
    }

    /// @dev Worker calls this; we forward to ReceiveUln302.verify so msg.sender (this contract) is the DVN.
    function submitVerification(
        bytes calldata _packetHeader,
        bytes32 _payloadHash,
        uint64 _confirmations
    ) external {
        receiveUln.verify(_packetHeader, _payloadHash, _confirmations);
    }

    /// @dev Single tx: verify then commit so PacketVerified is emitted. Use this to avoid cross-tx ordering issues.
    function submitAndCommit(
        bytes calldata _packetHeader,
        bytes32 _payloadHash,
        uint64 _confirmations
    ) external {
        receiveUln.verify(_packetHeader, _payloadHash, _confirmations);
        receiveUln.commitVerification(_packetHeader, _payloadHash);
    }
}
