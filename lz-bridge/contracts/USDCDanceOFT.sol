// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title USDC Dance OFT
 * @notice ERC-20 token with LayerZero cross-chain capabilities and x402 (EIP-3009) payment support
 * @dev Extends OFT for cross-chain transfers and implements EIP-3009 for x402 protocol compatibility.
 *      Enables seamless cross-chain payments between Base Sepolia and Story Aeneid via LayerZero V2.
 * 
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 * @custom:security This contract implements EIP-3009 for secure, gasless token transfers via signed authorizations.
 */
import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {IOFT, SendParam, MessagingFee, MessagingReceipt, OFTReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import {Origin} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract USDCDanceOFT is OFT {
    address public danceVerifyBackend;
    
    // Deployment version - updated for fresh deployments (Base Sepolia 0x6a7f89... was deployed with v1)
    uint256 public constant DEPLOYMENT_VERSION = 3;
    
    // EIP-3009: Transfer with Authorization
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    
    // EIP-712 Domain Separator
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    // Payment tracking
    mapping(bytes32 => bool) public usedNonces;
    mapping(string => PaymentInfo) public payments;
    
    struct PaymentInfo {
        address depositor;
        uint256 amount;
        uint256 timestamp;
        bool exists;
    }
    
    event PaymentReceived(
        address indexed from,
        uint256 amount,
        string receiptId,
        uint256 timestamp
    );
    
    event AuthorizationUsed(
        address indexed from,
        address indexed to,
        bytes32 indexed nonce
    );
    
    event TokensMinted(
        address indexed to,
        uint256 amount,
        address indexed minter
    );
    
    /**
     * @notice Initializes the USDC Dance OFT contract
     * @param _endpoint The LayerZero EndpointV2 address for cross-chain messaging
     * @param _delegate The address that will have ownership and can configure OApp settings
     * @param _backend The backend address for Dance Verify payment verification
     * @dev Sets up the token with name "USDC Dance" and symbol "USDC.d" with 6 decimals.
     *      Ownership is transferred to the delegate for OApp configuration management.
     */
    constructor(
        address _endpoint,
        address _delegate,
        address _backend
    ) OFT("USDC Dance", "USDC.d", _endpoint, _delegate) {
        require(_endpoint != address(0), "USDCDanceOFT: Endpoint cannot be zero");
        require(_delegate != address(0), "USDCDanceOFT: Delegate cannot be zero");
        require(_backend != address(0), "USDCDanceOFT: Backend cannot be zero");
        
        // OAppCore (via OFT -> OFTCore -> OApp) inherits from Ownable
        // OpenZeppelin v4 doesn't require constructor parameter, ownership is set via _transferOwnership
        _transferOwnership(_delegate);
        danceVerifyBackend = _backend;
    }
    
    /**
     * @notice Mint tokens for testing purposes (owner-only, testnet only)
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in token decimals, 6 for USDC.d)
     * @dev This function is intended for testnet testing only. In production, tokens should
     *      be minted only through cross-chain transfers via LayerZero.
     *      Only the contract owner can call this function.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "USDCDanceOFT: Cannot mint to zero address");
        require(amount > 0, "USDCDanceOFT: Amount must be greater than zero");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }
    
    /**
     * @notice Called by LayerZero when tokens arrive from remote chain
     * @param _origin Origin information (srcEid, sender, nonce)
     * @param _guid Message GUID
     * @param _message Encoded message containing recipient and amount
     * @param _executor Executor address
     * @param _extraData Extra data
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        // Call parent to handle token transfer
        super._lzReceive(_origin, _guid, _message, _executor, _extraData);
        
        // Decode extra data if it contains receiptId
        if (_extraData.length > 0) {
            (address from, uint256 amount, string memory receiptId) = 
                abi.decode(_extraData, (address, uint256, string));
            
            if (bytes(receiptId).length > 0) {
                // Store payment info for backend verification
                payments[receiptId] = PaymentInfo({
                    depositor: from,
                    amount: amount,
                    timestamp: block.timestamp,
                    exists: true
                });
                
                emit PaymentReceived(from, amount, receiptId, block.timestamp);
            }
        }
    }
    
    /**
     * @notice Agent calls this to pay for verification via LayerZero
     * @param _dstEid Destination endpoint ID (Story Aeneid = 1315)
     * @param _recipient Destination contract address in bytes32
     * @param _amount Amount to transfer (in local decimals, 6 for USDC.d)
     * @param _receiptId Receipt ID for payment tracking
     */
    function payViaLayerZero(
        uint32 _dstEid,
        bytes32 _recipient,
        uint256 _amount,
        string memory _receiptId
    ) external payable returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        // Encode receipt info in extraOptions or composeMsg
        bytes memory extraData = abi.encode(
            msg.sender, // original sender
            _amount,
            _receiptId
        );
        
        SendParam memory sendParam = SendParam({
            dstEid: _dstEid,
            to: _recipient,
            amountLD: _amount,
            minAmountLD: _amount, // No slippage tolerance
            extraOptions: bytes(""),
            composeMsg: extraData, // Store receipt info in compose message
            oftCmd: bytes("")
        });
        
        MessagingFee memory fee = MessagingFee({
            nativeFee: msg.value,
            lzTokenFee: 0
        });
        
        // Burn on source, will mint on destination after DVN validation
        // Note: send() is external, so we call it via this
        return this.send(sendParam, fee, payable(msg.sender));
    }
    
    /**
     * @notice EIP-3009: Transfer with Authorization (for x402 protocol)
     * @dev Allows a spender to transfer tokens on behalf of the owner using a signed authorization
     * @param from The address to transfer from
     * @param to The address to transfer to
     * @param amount The amount to transfer
     * @param validAfter The time after which this authorization is valid
     * @param validBefore The time before which this authorization is valid
     * @param nonce Unique nonce to prevent replay attacks
     * @param v Recovery byte of the signature
     * @param r R value of the signature
     * @param s S value of the signature
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!usedNonces[nonce], "Authorization already used");
        
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                amount,
                validAfter,
                validBefore,
                nonce
            )
        );
        
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("USDC Dance")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        
        address signer = ecrecover(digest, v, r, s);
        require(signer == from, "Invalid signature");
        
        usedNonces[nonce] = true;
        
        _transfer(from, to, amount);
        
        emit AuthorizationUsed(from, to, nonce);
    }
    
    /**
     * @notice Get payment info (for backend verification)
     * @param receiptId The receipt ID to look up
     * @return depositor The address that made the payment
     * @return amount The payment amount
     * @return timestamp When the payment was made
     * @return exists Whether the payment exists
     */
    function getPaymentInfo(string memory receiptId)
        external
        view
        returns (
            address depositor,
            uint256 amount,
            uint256 timestamp,
            bool exists
        )
    {
        PaymentInfo memory payment = payments[receiptId];
        return (payment.depositor, payment.amount, payment.timestamp, payment.exists);
    }
    
    /**
     * @notice Get domain separator for EIP-712 signing
     * @return The domain separator hash
     */
    function getDomainSeparator() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("USDC Dance")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
    
    /**
     * @notice Check if a nonce has been used
     * @param nonce The nonce to check
     * @return Whether the nonce has been used
     */
    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }
}
