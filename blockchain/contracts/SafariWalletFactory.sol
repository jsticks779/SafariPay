// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SafariSmartWallet.sol";

/**
 * @title SafariWalletFactory (CREATE2 Deployment)
 * @author SafariPay Engineering
 * @notice Responsible for gas-efficient deployment of user smart wallets.
 * USES: CREATE2 for deterministic addresses (User Wallet Address can be known BEFORE deployment).
 */
contract SafariWalletFactory {
    address public immutable safariGuardian;

    event WalletDeployed(address indexed walletAddress, address indexed owner, bytes32 nidaHash);

    constructor(address _safariGuardian) {
        safariGuardian = _safariGuardian;
    }

    /**
     * @notice Deploy a new SafariSmartWallet for a user deterministically.
     * @param _owner Initial owner key
     * @param _nidaHash keccak256 hash of NIDA
     * @param _phoneHash keccak256 hash of Phone
     * @param _salt Unique salt to ensure CREATE2 collision resistance
     */
    function createWallet(
        address _owner, 
        bytes32 _nidaHash, 
        bytes32 _phoneHash, 
        bytes32 _salt
    ) external returns (address) {
        address wallet = address(new SafariSmartWallet{salt: _salt}(
            _owner, 
            safariGuardian, 
            _nidaHash, 
            _phoneHash
        ));

        emit WalletDeployed(wallet, _owner, _nidaHash);
        return wallet;
    }

    /**
     * @notice Predict a user's wallet address BEFORE deployment.
     * Helpful for showing the address during registration without paying gas yet.
     */
    function predictAddress(
        address _owner, 
        bytes32 _nidaHash, 
        bytes32 _phoneHash, 
        bytes32 _salt
    ) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(SafariSmartWallet).creationCode,
            abi.encode(_owner, safariGuardian, _nidaHash, _phoneHash)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), _salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }
}
