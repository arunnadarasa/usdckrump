// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title USDC Krump OFT
 * @notice ERC-20 token "USDC.k" with LayerZero cross-chain capabilities and x402 (EIP-3009) payment support.
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

contract USDCKrumpOFT is OFT {
    address public krumpVerifyBackend;

    uint256 public constant DEPLOYMENT_VERSION = 1;

    /**
     * @dev Override decimals to return 6 (USDC standard)
     * @return The number of decimals for the token (6)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    string private constant EIP712_NAME = "USDC Krump";

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

    constructor(
        address _endpoint,
        address _delegate,
        address _backend
    ) OFT("USDC Krump", "USDC.k", _endpoint, _delegate) {
        require(_endpoint != address(0), "USDCKrumpOFT: Endpoint cannot be zero");
        require(_delegate != address(0), "USDCKrumpOFT: Delegate cannot be zero");
        require(_backend != address(0), "USDCKrumpOFT: Backend cannot be zero");

        _transferOwnership(_delegate);
        krumpVerifyBackend = _backend;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "USDCKrumpOFT: Cannot mint to zero address");
        require(amount > 0, "USDCKrumpOFT: Amount must be greater than zero");

        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        super._lzReceive(_origin, _guid, _message, _executor, _extraData);

        if (_extraData.length > 0) {
            (address from, uint256 amount, string memory receiptId) =
                abi.decode(_extraData, (address, uint256, string));

            if (bytes(receiptId).length > 0) {
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

    function payViaLayerZero(
        uint32 _dstEid,
        bytes32 _recipient,
        uint256 _amount,
        string memory _receiptId
    ) external payable returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        bytes memory extraData = abi.encode(
            msg.sender,
            _amount,
            _receiptId
        );

        SendParam memory sendParam = SendParam({
            dstEid: _dstEid,
            to: _recipient,
            amountLD: _amount,
            minAmountLD: _amount,
            extraOptions: bytes(""),
            composeMsg: extraData,
            oftCmd: bytes("")
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: msg.value,
            lzTokenFee: 0
        });

        return this.send(sendParam, fee, payable(msg.sender));
    }

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
                keccak256(bytes(EIP712_NAME)),
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

    function getDomainSeparator() external view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }
}
