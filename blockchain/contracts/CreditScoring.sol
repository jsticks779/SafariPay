// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreditScoring
 * @dev Manages on-chain credit scores for users based on activity data.
 */
contract CreditScoring is Ownable {
    mapping(address => uint256) public scores;
    mapping(address => uint256) public totalTransactions;
    mapping(address => uint256) public totalVolume;

    event ScoreUpdated(address indexed user, uint256 newScore);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Updates the score based on activity. In a real scenario, this would be updated
     * via an oracle or a back-end relayer with verified data.
     */
    function updateScore(address user, uint256 transactionCount, uint256 volume) external onlyOwner {
        totalTransactions[user] = transactionCount;
        totalVolume[user] = volume;
        
        // Simple logic for simulation: 
        // Base score 300, max 850.
        uint256 newScore = 300 + (transactionCount * 5) + (volume / 1e18); // Volume in stablecoin units
        if (newScore > 850) newScore = 850;
        
        scores[user] = newScore;
        emit ScoreUpdated(user, newScore);
    }

    function getScore(address user) external view returns (uint256) {
        return scores[user] == 0 ? 300 : scores[user];
    }
}
