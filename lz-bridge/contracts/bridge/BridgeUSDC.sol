// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeUSDC
 * @notice ERC20 "USDC.k" (USDC Krump) minted on Story Aeneid when the custom bridge fulfills a lock from Base Sepolia.
 *         Only the BridgeReceiver can mint. Implements EIP-3009 for x402/OpenClaw agent payments on EVVM 1140.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 * @custom:security This contract implements EIP-3009 for gasless transfers via signed authorizations.
 */
contract BridgeUSDC is ERC20, Ownable {
    address public minter;

    uint8 private constant DECIMALS = 6;
    string private constant EIP712_NAME = "USDC Krump";

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    mapping(bytes32 => bool) public usedNonces;

    event MinterSet(address indexed previousMinter, address indexed newMinter);
    event AuthorizationUsed(address indexed from, address indexed to, bytes32 indexed nonce);

    error OnlyMinter();
    error ZeroMinter();

    constructor() ERC20("USDC Krump", "USDC.k") {
        // Owner can set minter after BridgeReceiver is deployed
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Set the only address allowed to mint (BridgeReceiver). Call once after deploying BridgeReceiver.
    function setMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroMinter();
        address old = minter;
        minter = _minter;
        emit MinterSet(old, _minter);
    }

    /// @notice Mint bridged USDC to recipient. Only callable by minter (BridgeReceiver).
    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert OnlyMinter();
        _mint(to, amount);
    }

    /// @notice EIP-3009: Transfer with Authorization (x402 protocol). Same interface as USDCDanceOFT for EVVMPaymentAdapter.
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
        require(block.timestamp > validAfter, "BridgeUSDC: auth not yet valid");
        require(block.timestamp < validBefore, "BridgeUSDC: auth expired");
        require(!usedNonces[nonce], "BridgeUSDC: nonce used");

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
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        require(signer == from, "BridgeUSDC: invalid signature");

        usedNonces[nonce] = true;
        _transfer(from, to, amount);
        emit AuthorizationUsed(from, to, nonce);
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
