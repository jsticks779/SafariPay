// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CreditScoring.sol";

/**
 * @title LendingPool
 * @dev Handles micro-loans based on credit scores.
 */
contract LendingPool is Ownable {
    IERC20 public stablecoin;
    CreditScoring public creditScoring;
    
    uint256 public constant INTEREST_RATE = 5; // 5% flat for simulation
    uint256 public constant MIN_SCORE = 500;
    uint256 public constant RESERVE_RATIO = 20; // 20%
    
    uint256 public totalLent;

    struct Loan {
        uint256 amount;
        uint256 repaymentAmount;
        uint256 dueDate;
        bool active;
    }
    
    mapping(address => Loan) public activeLoans;

    event LoanRequested(address indexed user, uint256 amount, uint256 repaymentAmount);
    event LoanRepaid(address indexed user, uint256 amount);

    constructor(address _stablecoin, address _creditScoring) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoin);
        creditScoring = CreditScoring(_creditScoring);
    }

    function requestLoan(uint256 amount) external {
        require(!activeLoans[msg.sender].active, "Already have an active loan");
        require(creditScoring.getScore(msg.sender) >= MIN_SCORE, "Credit score too low");
        
        // Liquidity Protection: Ensure total loans <= 20% of pool liquidity
        uint256 totalLiquidity = stablecoin.balanceOf(address(this)) + totalLent;
        require(totalLent + amount <= (totalLiquidity * RESERVE_RATIO / 100), "Lending pool liquidity limit reached");

        uint256 repayment = amount + (amount * INTEREST_RATE / 100);
        activeLoans[msg.sender] = Loan({
            amount: amount,
            repaymentAmount: repayment,
            dueDate: block.timestamp + 30 days,
            active: true
        });

        totalLent += amount;

        require(stablecoin.transfer(msg.sender, amount), "Loan disbursement failed");
        emit LoanRequested(msg.sender, amount, repayment);
    }

    function repayLoan() external {
        Loan storage loan = activeLoans[msg.sender];
        require(loan.active, "No active loan found");
        
        require(stablecoin.transferFrom(msg.sender, address(this), loan.repaymentAmount), "Repayment failed");
        
        totalLent -= loan.amount;
        loan.active = false;
        emit LoanRepaid(msg.sender, loan.repaymentAmount);
    }
}
