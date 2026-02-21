// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title USDC Krump
 * @notice ERC20 token for USDC Krump (USDC.k) on Story Aeneid
 * @dev This is the USDC Krump token that can be used with OAppProxyOFT.
 *      Users can wrap/unwrap USDC-equivalent tokens, or this can be minted
 *      by authorized minters for bridging purposes.
 *
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WrappedUSDC is ERC20, Ownable {
    /**
     * @dev Mapping of authorized minters
     */
    mapping(address => bool) public minters;

    /**
     * @dev Event emitted when a minter is added or removed
     */
    event MinterUpdated(address indexed minter, bool allowed);

    /**
     * @dev Constructor
     * @param _initialSupply Initial supply to mint to deployer (can be 0)
     */
    constructor(uint256 _initialSupply) ERC20("USDC Krump", "USDC.k") Ownable() {
        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
        }
    }

    /**
     * @dev Returns the number of decimals (6, matching USDC standard)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Mint tokens (only by owner or authorized minters)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        require(owner() == msg.sender || minters[msg.sender], "WrappedUSDC: Not authorized");
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Add or remove a minter
     * @param minter Address of the minter
     * @param allowed Whether the minter is allowed to mint
     */
    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    /**
     * @dev Batch set minters
     * @param minters_ Array of minter addresses
     * @param allowed Array of allowed statuses
     */
    function setMinters(address[] calldata minters_, bool[] calldata allowed) external onlyOwner {
        require(minters_.length == allowed.length, "WrappedUSDC: Arrays length mismatch");
        for (uint256 i = 0; i < minters_.length; i++) {
            minters[minters_[i]] = allowed[i];
            emit MinterUpdated(minters_[i], allowed[i]);
        }
    }
}
