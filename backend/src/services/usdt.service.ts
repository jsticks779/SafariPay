/**
 * SafariPay — USDT Token Service (Production-Ready)
 * ===================================================
 * Handles all USDT (ERC-20) operations on Polygon:
 *   - Balance queries
 *   - Transfers with gas estimation
 *   - Allowance management
 *   - Transaction status tracking
 *
 * USDT on Polygon uses 6 decimals (not 18).
 */

import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';
import { BlockchainConfig } from '../config/blockchain.config';
import { logger } from '../utils/logger';

export class UsdtService {
    /**
     * Returns the USDT contract instance.
     * Read-only if no signer provided.
     */
    private static getContract(signer?: ethers.Signer): ethers.Contract {
        return BlockchainService.getContract('USDT', signer || BlockchainService.getProvider());
    }

    /**
     * Get USDT balance for an address.
     * @returns Balance as a human-readable string (e.g. "10.50")
     */
    static async getBalance(address: string): Promise<string> {
        if (!BlockchainService.isValidAddress(address)) {
            throw new Error(`Invalid address: ${address}`);
        }

        try {
            const contract = this.getContract();
            const rawBalance: bigint = await contract.balanceOf(address);
            const formatted = ethers.formatUnits(rawBalance, BlockchainConfig.USDT_DECIMALS);
            logger.info('USDT', `Balance query: ${address.slice(0, 10)}... = ${formatted} USDT`);
            return formatted;
        } catch (err: any) {
            logger.error('USDT', `Balance query failed for ${address}: ${err.message}`);
            throw new Error('Failed to fetch USDT balance');
        }
    }

    /**
     * Get raw USDT balance (in smallest unit, 6 decimals).
     */
    static async getRawBalance(address: string): Promise<bigint> {
        const contract = this.getContract();
        return contract.balanceOf(address);
    }

    /**
     * Transfer USDT from one address to another.
     * Uses the custodial model: server signs with the user's encrypted private key.
     *
     * @param privateKey — Decrypted sender private key (NEVER log this)
     * @param toAddress — Recipient address
     * @param amount — Amount in human-readable units (e.g. "10.5" for 10.5 USDT)
     * @returns Transaction hash and receipt
     */
    static async transfer(
        privateKey: string,
        toAddress: string,
        amount: string
    ): Promise<{ txHash: string; receipt: ethers.TransactionReceipt }> {
        // ─── Input Validation ───────────────────────────────────
        if (!BlockchainService.isValidAddress(toAddress)) {
            throw new Error(`Invalid recipient address: ${toAddress}`);
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error(`Invalid amount: ${amount}`);
        }

        // ─── Prepare ────────────────────────────────────────────
        const signer = BlockchainService.getSigner(privateKey);
        const senderAddress = await signer.getAddress();
        const contract = this.getContract(signer);
        const rawAmount = ethers.parseUnits(amount, BlockchainConfig.USDT_DECIMALS);

        // ─── Pre-flight Checks ──────────────────────────────────
        // Check USDT balance
        const balance: bigint = await contract.balanceOf(senderAddress);
        if (balance < rawAmount) {
            const readableBalance = ethers.formatUnits(balance, BlockchainConfig.USDT_DECIMALS);
            throw new Error(`Insufficient USDT. Have: ${readableBalance}, Need: ${amount}`);
        }

        // Check MATIC for gas
        const maticBalance = await BlockchainService.getProvider().getBalance(senderAddress);
        if (maticBalance < ethers.parseEther('0.01')) {
            logger.warn('GAS', `Low MATIC for gas: ${senderAddress} has ${ethers.formatEther(maticBalance)} MATIC`);
            throw new Error('Insufficient MATIC for gas fees');
        }

        // ─── Execute Transfer ───────────────────────────────────
        logger.tx('SUBMIT', 'pending', {
            from: senderAddress.slice(0, 10) + '...',
            to: toAddress.slice(0, 10) + '...',
            amount: `${amount} USDT`,
        });

        try {
            const tx = await contract.transfer(toAddress, rawAmount);
            const txHash = tx.hash;
            logger.tx('PENDING', txHash);

            // Wait for confirmation
            const receipt = await BlockchainService.waitForConfirmation(txHash);
            logger.tx('CONFIRMED', txHash, { block: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() });

            return { txHash, receipt };
        } catch (err: any) {
            logger.tx('FAILED', 'N/A', { error: err.message });
            throw new Error(`USDT transfer failed: ${err.message}`);
        }
    }

    /**
     * Check allowance for a spender.
     */
    static async getAllowance(ownerAddress: string, spenderAddress: string): Promise<string> {
        const contract = this.getContract();
        const allowance: bigint = await contract.allowance(ownerAddress, spenderAddress);
        return ethers.formatUnits(allowance, BlockchainConfig.USDT_DECIMALS);
    }

    /**
     * Approve a spender to transfer USDT on behalf of the owner.
     */
    static async approve(
        privateKey: string,
        spenderAddress: string,
        amount: string
    ): Promise<string> {
        const signer = BlockchainService.getSigner(privateKey);
        const contract = this.getContract(signer);
        const rawAmount = ethers.parseUnits(amount, BlockchainConfig.USDT_DECIMALS);

        const tx = await contract.approve(spenderAddress, rawAmount);
        const receipt = await BlockchainService.waitForConfirmation(tx.hash);
        logger.info('USDT', `Approval granted: ${spenderAddress} for ${amount} USDT`, { txHash: tx.hash });
        return tx.hash;
    }

    /**
     * Parse a USDT amount from smallest unit to human-readable.
     */
    static formatAmount(rawAmount: bigint): string {
        return ethers.formatUnits(rawAmount, BlockchainConfig.USDT_DECIMALS);
    }

    /**
     * Convert a human-readable USDT amount to smallest unit.
     */
    static parseAmount(amount: string): bigint {
        return ethers.parseUnits(amount, BlockchainConfig.USDT_DECIMALS);
    }
}
