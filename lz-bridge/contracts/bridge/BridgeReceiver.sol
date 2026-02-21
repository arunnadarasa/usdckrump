// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { BridgeUSDC } from "./BridgeUSDC.sol";

/**
 * @title BridgeReceiver
 * @notice Receives lock fulfillment from the relayer and mints USDC.k on Story Aeneid (Base → Story).
 *         Users can lock back USDC.k to receive USDC on Base Sepolia (Story → Base). Only attester can fulfillLock/release.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract BridgeReceiver {
    BridgeUSDC public immutable bridgeUsdc;
    address public attester;

    /// @notice Replay protection for fulfillLock (Base → Story)
    mapping(uint64 sourceChainId => mapping(uint256 nonce => bool)) public usedNonce;
    /// @notice Replay protection for lockBack (Story → Base)
    uint256 public nonceBack;
    mapping(uint256 nonce => bool) public usedNonceBack;

    event FulfillLock(
        uint64 indexed sourceChainId,
        uint256 indexed nonce,
        address indexed recipient,
        uint256 amount
    );
    /// @notice Emitted when user locks USDC.k to bridge back to Base Sepolia
    event LockRequestBack(
        uint64 indexed destinationChainId,
        address indexed sender,
        address indexed destinationRecipient,
        uint256 amount,
        uint256 nonce
    );
    event AttesterSet(address indexed previousAttester, address indexed newAttester);

    error OnlyAttester();
    error AlreadyFulfilled();
    error ZeroRecipient();
    error ZeroAmount();

    modifier onlyAttester() {
        if (msg.sender != attester) revert OnlyAttester();
        _;
    }

    constructor(address _bridgeUsdc, address _attester) {
        require(_bridgeUsdc != address(0), "BridgeReceiver: zero bridgeUsdc");
        require(_attester != address(0), "BridgeReceiver: zero attester");
        bridgeUsdc = BridgeUSDC(_bridgeUsdc);
        attester = _attester;
    }

    /**
     * @notice Fulfill a lock from the source chain: mint BridgeUSDC to the recipient.
     * @param sourceChainId Chain ID where the lock happened (e.g. 84532 for Base Sepolia).
     * @param nonce Nonce from the LockRequest event.
     * @param recipient Address to credit on this chain (Story Aeneid).
     * @param amount Amount to mint (6 decimals).
     */
    function fulfillLock(
        uint64 sourceChainId,
        uint256 nonce,
        address recipient,
        uint256 amount
    ) external onlyAttester {
        if (recipient == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();
        if (usedNonce[sourceChainId][nonce]) revert AlreadyFulfilled();

        usedNonce[sourceChainId][nonce] = true;
        bridgeUsdc.mint(recipient, amount);

        emit FulfillLock(sourceChainId, nonce, recipient, amount);
    }

    /**
     * @notice Lock USDC.k to bridge back to Base Sepolia. User transfers USDC.k to this contract; relayer releases USDC on Base.
     * @param amount Amount to lock (6 decimals).
     * @param destinationRecipient Address to credit on Base Sepolia.
     */
    function lockBack(uint256 amount, address destinationRecipient) external {
        if (amount == 0) revert ZeroAmount();
        if (destinationRecipient == address(0)) revert ZeroRecipient();

        bridgeUsdc.transferFrom(msg.sender, address(this), amount);
        uint256 currentNonce = nonceBack;
        nonceBack = currentNonce + 1;

        // Base Sepolia chain ID for relayer to release there
        emit LockRequestBack(84532, msg.sender, destinationRecipient, amount, currentNonce);
    }

    /// @notice Change the attester (e.g. to a multisig). In PoC, only deployer can do this; add Ownable if needed.
    function setAttester(address _attester) external {
        if (msg.sender != attester) revert OnlyAttester();
        require(_attester != address(0), "BridgeReceiver: zero attester");
        address old = attester;
        attester = _attester;
        emit AttesterSet(old, _attester);
    }
}
