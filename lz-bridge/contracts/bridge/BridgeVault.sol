// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BridgeVault
 * @notice Holds locked USDC on Base Sepolia. Users lock USDC → relayer mints USDC.k on Story Aeneid.
 *         Users lock USDC.k on Story Aeneid → relayer calls release here to send USDC to recipient.
 * @dev PoC: trusted relayer/attester; replay protection via nonce.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract BridgeVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint64 public immutable sourceChainId;
    address public attester;
    uint256 public nonce;

    /// @notice Replay protection for release (Story → Base)
    mapping(uint64 sourceChainId => mapping(uint256 nonce => bool)) public usedReleaseNonce;

    event LockRequest(
        uint64 indexed sourceChainId,
        address indexed sender,
        address indexed destinationRecipient,
        uint256 amount,
        uint256 nonce
    );
    event Release(
        uint64 indexed sourceChainId,
        uint256 indexed nonce,
        address indexed recipient,
        uint256 amount
    );
    event AttesterSet(address indexed previousAttester, address indexed newAttester);

    error ZeroAmount();
    error ZeroRecipient();
    error OnlyAttester();
    error AlreadyReleased();

    modifier onlyAttester() {
        if (msg.sender != attester) revert OnlyAttester();
        _;
    }

    constructor(address _token, uint64 _sourceChainId, address _attester) {
        require(_token != address(0), "BridgeVault: zero token");
        require(_attester != address(0), "BridgeVault: zero attester");
        token = IERC20(_token);
        sourceChainId = _sourceChainId;
        attester = _attester;
    }

    /**
     * @notice Lock tokens and emit a request for the relayer to fulfill on the destination chain.
     * @param amount Amount to lock (same decimals as the token, e.g. 6 for USDC).
     * @param destinationRecipient Address to credit on the destination chain (Story Aeneid).
     */
    function lock(uint256 amount, address destinationRecipient) external {
        if (amount == 0) revert ZeroAmount();
        if (destinationRecipient == address(0)) revert ZeroRecipient();

        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 currentNonce = nonce;
        nonce = currentNonce + 1;

        emit LockRequest(
            sourceChainId,
            msg.sender,
            destinationRecipient,
            amount,
            currentNonce
        );
    }

    /**
     * @notice Release USDC to recipient when relayer fulfills a LockRequestBack from Story Aeneid.
     * @param recipient Address to credit on this chain (Base Sepolia).
     * @param amount Amount to transfer (6 decimals).
     * @param _sourceChainId Chain ID where lockBack happened (1315 for Story Aeneid).
     * @param _nonce Nonce from the LockRequestBack event.
     */
    function release(
        address recipient,
        uint256 amount,
        uint64 _sourceChainId,
        uint256 _nonce
    ) external onlyAttester {
        if (recipient == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();
        if (usedReleaseNonce[_sourceChainId][_nonce]) revert AlreadyReleased();

        usedReleaseNonce[_sourceChainId][_nonce] = true;
        token.safeTransfer(recipient, amount);

        emit Release(_sourceChainId, _nonce, recipient, amount);
    }

    function setAttester(address _attester) external onlyAttester {
        require(_attester != address(0), "BridgeVault: zero attester");
        address old = attester;
        attester = _attester;
        emit AttesterSet(old, _attester);
    }
}
