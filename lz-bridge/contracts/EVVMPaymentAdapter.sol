// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EVVM Payment Adapter
 * @notice Bridges x402 (EIP-3009) payments with EVVM Core for autonomous agent interactions
 * @dev Allows OpenClaw agents to pay with USDC.d via x402 protocol on EVVM.
 *      Enables seamless autonomous payments from OpenClaw agents to human owners via EVVM.
 * 
 * Integration Flow:
 * 1. Agent signs EIP-3009 authorization (x402 protocol)
 * 2. Adapter executes transferWithAuthorization on USDCDanceOFT
 * 3. Adapter calls EVVM Core's pay function to route payment
 * 4. Human owner receives USDC.d autonomously via EVVM
 * 
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 * @custom:security This contract integrates with EVVM Core for secure, autonomous payment routing.
 */
import "./USDCDanceOFT.sol";

contract EVVMPaymentAdapter {
    /// @notice Reference to the USDCDanceOFT token contract
    USDCDanceOFT public immutable usdcDance;
    
    /// @notice Reference to the EVVM Core contract
    address public immutable evvmCore;
    
    /// @notice EVVM instance ID (1140 for Story Aeneid)
    uint256 public immutable evvmId;
    
    /// @notice Owner address that can update adapter settings
    address public owner;
    
    /// @notice Tracks processed x402 payments to prevent replay attacks
    mapping(bytes32 => bool) public processedPayments;
    
    /// @notice Stores EVVM payment information by receipt ID
    mapping(string => EVVMPaymentInfo) public evvmPayments;
    
    /// @notice EVVM payment information structure
    struct EVVMPaymentInfo {
        address from;
        address to;
        uint256 amount;
        string receiptId;
        uint256 timestamp;
        bool exists;
    }
    
    /// @notice Emitted when an x402 payment is processed through EVVM
    event EVVMPaymentProcessed(
        address indexed from,
        address indexed to,
        uint256 amount,
        string receiptId,
        bytes32 x402Nonce
    );
    
    /// @notice Emitted when the owner address is updated
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);
    
    /**
     * @notice Initializes the EVVM Payment Adapter contract
     * @param _usdcDance The address of the USDCDanceOFT token contract
     * @param _evvmCore The address of the EVVM Core contract
     * @param _evvmId The EVVM instance ID (1140 for Story Aeneid)
     * @param _owner The owner address that can update adapter settings
     * @dev Sets up the adapter to bridge x402 payments with EVVM Core for autonomous agent payments
     */
    constructor(
        address _usdcDance,
        address _evvmCore,
        uint256 _evvmId,
        address _owner
    ) {
        require(_usdcDance != address(0), "EVVMPaymentAdapter: Invalid USDC.d address");
        require(_evvmCore != address(0), "EVVMPaymentAdapter: Invalid EVVM Core address");
        require(_owner != address(0), "EVVMPaymentAdapter: Invalid owner address");
        
        usdcDance = USDCDanceOFT(_usdcDance);
        evvmCore = _evvmCore;
        evvmId = _evvmId;
        owner = _owner;
    }
    
    /**
     * @notice Process x402 payment and route through EVVM Core
     * @dev Accepts EIP-3009 authorization, executes transfer, then routes via EVVM.
     *      This enables OpenClaw agents to make autonomous payments via x402 protocol.
     * @param from The address authorizing the payment (must match signature)
     * @param to The recipient address
     * @param toIdentity The EVVM identity string for the recipient
     * @param amount The payment amount in USDC.d (6 decimals)
     * @param validAfter Timestamp after which authorization is valid
     * @param validBefore Timestamp before which authorization expires
     * @param nonce Unique nonce to prevent replay attacks
     * @param v Recovery byte of the ECDSA signature
     * @param r R value of the ECDSA signature
     * @param s S value of the ECDSA signature
     * @param receiptId Receipt ID for payment tracking
     * @param evvmNonce EVVM nonce for the payment transaction
     * @param isAsyncExec Whether to execute asynchronously on EVVM
     * @param evvmSignature EVVM signature for the payment
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
        require(!processedPayments[nonce], "EVVMPaymentAdapter: Payment already processed");
        
        // Step 1: Execute x402 payment (EIP-3009 transferWithAuthorization)
        usdcDance.transferWithAuthorization(
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        
        // Step 2: Approve EVVM Core to spend USDC.d
        usdcDance.approve(evvmCore, amount);
        
        // Step 3: Route payment through EVVM Core
        (bool success, ) = evvmCore.call(
            abi.encodeWithSignature(
                "pay(address,address,string,address,uint256,uint256,address,uint256,bool,bytes)",
                from,
                to,
                toIdentity,
                address(usdcDance),
                amount,
                0,
                address(0),
                evvmNonce,
                isAsyncExec,
                evvmSignature
            )
        );
        
        require(success, "EVVMPaymentAdapter: EVVM payment failed");
        
        // Step 4: Record payment
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
    
    /**
     * @notice Get EVVM payment information by receipt ID
     * @param receiptId The receipt ID to look up
     * @return from The address that made the payment
     * @return to The recipient address
     * @return amount The payment amount
     * @return timestamp When the payment was processed
     * @return exists Whether the payment exists
     */
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
    
    /**
     * @notice Update the owner address
     * @param _newOwner The new owner address
     * @dev Only the current owner can call this function
     */
    function setOwner(address _newOwner) external {
        require(msg.sender == owner, "EVVMPaymentAdapter: Only owner");
        require(_newOwner != address(0), "EVVMPaymentAdapter: Invalid owner");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnerUpdated(oldOwner, _newOwner);
    }
}
