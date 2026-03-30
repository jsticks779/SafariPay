// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SafariPayPhoneRegistry
 * @notice Map phone number hashes to Smart Wallet Addresses.
 * Ensures privacy (only hashes) while allowing decentralized discovery.
 */
contract SafariPayPhoneRegistry {
    address public guardian;
    
    // keccak256(phoneNumber) -> Wallet Address
    mapping(bytes32 => address) public registry;
    
    // Reverse lookup for verification (optional, can be disabled for privacy)
    mapping(address => bytes32) public reverseRegistry;

    event IdentityLinked(bytes32 indexed phoneHash, address indexed wallet);

    constructor(address _guardian) {
        guardian = _guardian;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Only Guardian can register identities");
        _;
    }

    /**
     * @notice Link a phone number hash to a specific wallet. (Called by Guardian)
     * @param _phoneHash keccak256 of the phone number.
     * @param _wallet The user's Smart Wallet address.
     */
    function registerIdentity(bytes32 _phoneHash, address _wallet) external onlyGuardian {
        require(registry[_phoneHash] == address(0), "Identity already linked");
        
        registry[_phoneHash] = _wallet;
        reverseRegistry[_wallet] = _phoneHash;
        
        emit IdentityLinked(_phoneHash, _wallet);
    }

    /**
     * @notice Look up a wallet address by phone hash.
     * @param _phoneHash keccak256 of the phone number.
     */
    function resolve(bytes32 _phoneHash) external view returns (address) {
        return registry[_phoneHash];
    }
}
