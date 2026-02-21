// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EVVM Native x402 Adapter
 * @notice x402-compatible adapter that routes payments via EVVM native flow (no EIP-3009 on token).
 * @dev HTTP 402 requests still carry EIP-3009-style authorization; this adapter verifies that
 *      signature on-chain and calls EVVM Core pay() only. Patmasters and async nonces are native
 *      to EVVM, so the token (USDC Krump) does not need transferWithAuthorization.
 *
 * Flow:
 * 1. Agent signs x402 authorization (EIP-712 with verifyingContract = this adapter).
 * 2. Adapter verifies signature and replay (nonce), then calls evvmCore.pay(...).
 * 3. EVVM Core pulls USDC Krump from payer via its native mechanism (executor + async nonce).
 *
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 * @custom:security Uses EIP-712 for x402 auth; EVVM Core handles token pull natively.
 */
contract EVVMNativeX402Adapter {
    /// @notice USDC Krump (or BridgeUSDC) token address passed to EVVM Core
    address public immutable token;
    /// @notice EVVM Core contract
    address public immutable evvmCore;
    /// @notice EVVM instance ID (1140 for Story Aeneid)
    uint256 public immutable evvmId;
    /// @notice Owner
    address public owner;

    /// @notice Replay protection for x402 nonces
    mapping(bytes32 => bool) public processedPayments;
    /// @notice Payment info by receipt ID
    mapping(string => EVVMPaymentInfo) public evvmPayments;

    struct EVVMPaymentInfo {
        address from;
        address to;
        uint256 amount;
        string receiptId;
        uint256 timestamp;
        bool exists;
    }

    event EVVMPaymentProcessed(
        address indexed from,
        address indexed to,
        uint256 amount,
        string receiptId,
        bytes32 x402Nonce
    );
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);

    // EIP-712: same typehash as EIP-3009 / x402 signer (verifyingContract = this adapter)
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    constructor(
        address _token,
        address _evvmCore,
        uint256 _evvmId,
        address _owner
    ) {
        require(_token != address(0), "EVVMNativeX402Adapter: Invalid token");
        require(_evvmCore != address(0), "EVVMNativeX402Adapter: Invalid EVVM Core");
        require(_owner != address(0), "EVVMNativeX402Adapter: Invalid owner");
        token = _token;
        evvmCore = _evvmCore;
        evvmId = _evvmId;
        owner = _owner;
    }

    /**
     * @notice Process x402 payment via EVVM native (verify x402 signature, call EVVM pay only).
     * @param from Payer (must match x402 signature)
     * @param to Recipient
     * @param toIdentity EVVM identity for recipient
     * @param amount Amount (6 decimals)
     * @param validAfter / validBefore Validity window for x402 auth
     * @param nonce x402 nonce (replay protection)
     * @param v, r, s ECDSA of EIP-712 digest (verifyingContract = this adapter)
     * @param receiptId Receipt ID
     * @param evvmNonce EVVM async/sync nonce
     * @param isAsyncExec Use async execution on EVVM
     * @param evvmSignature EVVM Core pay signature
     */
    function payViaEVVMWithX402(
        address from,
        address to,
        string memory toIdentity,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string memory receiptId,
        uint256 evvmNonce,
        bool isAsyncExec,
        bytes memory evvmSignature
    ) external {
        require(!processedPayments[nonce], "EVVMNativeX402Adapter: Payment already processed");
        require(block.timestamp >= validAfter, "EVVMNativeX402Adapter: Authorization not yet valid");
        require(block.timestamp <= validBefore, "EVVMNativeX402Adapter: Authorization expired");

        // x402 auth is "from authorizes transfer to this adapter"
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce
        ));
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes("USDC Dance")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        require(signer == from, "EVVMNativeX402Adapter: Invalid x402 signature");

        (bool success, ) = evvmCore.call(
            abi.encodeWithSignature(
                "pay(address,address,string,address,uint256,uint256,address,uint256,bool,bytes)",
                from,
                to,
                toIdentity,
                token,
                amount,
                0,
                address(0),
                evvmNonce,
                isAsyncExec,
                evvmSignature
            )
        );
        require(success, "EVVMNativeX402Adapter: EVVM payment failed");

        processedPayments[nonce] = true;
        evvmPayments[receiptId] = EVVMPaymentInfo({
            from: from,
            to: to,
            amount: amount,
            receiptId: receiptId,
            timestamp: block.timestamp,
            exists: true
        });
        emit EVVMPaymentProcessed(from, to, amount, receiptId, nonce);
    }

    function getEVVMPaymentInfo(string memory receiptId)
        external
        view
        returns (
            address from,
            address to,
            uint256 amount,
            uint256 timestamp,
            bool exists
        )
    {
        EVVMPaymentInfo memory payment = evvmPayments[receiptId];
        return (payment.from, payment.to, payment.amount, payment.timestamp, payment.exists);
    }

    function setOwner(address _newOwner) external {
        require(msg.sender == owner, "EVVMNativeX402Adapter: Only owner");
        require(_newOwner != address(0), "EVVMNativeX402Adapter: Invalid owner");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnerUpdated(oldOwner, _newOwner);
    }
}
