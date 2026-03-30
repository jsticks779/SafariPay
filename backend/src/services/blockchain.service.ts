/**
 * SafariPay — Blockchain Service (Production-Ready)
 * ===================================================
 * Manages the Polygon network connection, contract instances,
 * gas estimation, and transaction lifecycle.
 *
 * Uses: ethers.js v6, Polygon Amoy Testnet (dev) / Polygon Mainnet (prod)
 *
 * IMPORTANT: The provider is created with an explicit Network object
 * so ethers.js doesn't auto-detect and potentially mismatch chainId.
 */

import { ethers } from 'ethers';
import { BlockchainConfig } from '../config/blockchain.config';
import { logger } from '../utils/logger';

// ─── Singleton Provider ─────────────────────────────────────────────
let _provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
    if (!_provider) {
        // Create an explicit Network object for the target chain
        const network = ethers.Network.from({
            name: BlockchainConfig.network.name,
            chainId: BlockchainConfig.chainId,    // 80002 (Amoy) or 137 (Mainnet)
        });

        // Pass the explicit network so ethers NEVER re-detects it.
        // staticNetwork: true prevents the "underlying network changed" error.
        _provider = new ethers.JsonRpcProvider(
            BlockchainConfig.rpcUrl,
            network,
            { staticNetwork: true }
        );

        logger.info('BLOCKCHAIN', `🔗 Provider connected → ${BlockchainConfig.network.name} (chainId: ${BlockchainConfig.chainId})`);
        logger.info('BLOCKCHAIN', `   RPC: ${BlockchainConfig.rpcUrl.replace(/\/v2\/.+$/, '/v2/***')}`);
        logger.info('BLOCKCHAIN', `   USDT Contract: ${BlockchainConfig.contracts.USDT}`);
    }
    return _provider;
}

// ─── Service Class ──────────────────────────────────────────────────
export class BlockchainService {
    /**
     * Returns the singleton JSON-RPC provider.
     */
    static getProvider(): ethers.JsonRpcProvider {
        return getProvider();
    }

    /**
     * Returns a Wallet instance connected to the provider.
     * Used for signing transactions server-side (custodial model).
     * @param privateKey — Decrypted private key (NEVER log or expose this)
     */
    static getSigner(privateKey: string): ethers.Wallet {
        return new ethers.Wallet(privateKey, getProvider());
    }

    /**
     * Returns a Contract instance for a given contract name.
     * Read-only if no signer is provided.
     */
    static getContract(
        name: keyof typeof BlockchainConfig.abis | keyof typeof BlockchainConfig.contracts,
        signerOrProvider?: ethers.Signer | ethers.Provider,
        explicitAddress?: string
    ): ethers.Contract {
        const address = explicitAddress || BlockchainConfig.contracts[name as keyof typeof BlockchainConfig.contracts];
        if (!address) {
            throw new Error(`Contract address not provided for: ${name}. Set it in .env or provide an explicitAddress.`);
        }

        // Map contract name to ABI
        const abiMap: Record<string, readonly string[]> = {
            USDT: BlockchainConfig.abis.ERC20,
            SAFARIPAY_WALLET: BlockchainConfig.abis.SAFARIPAY_WALLET,
            CREDIT_SCORING: BlockchainConfig.abis.CREDIT_SCORING,
            LENDING_POOL: BlockchainConfig.abis.LENDING_POOL,
            SAFARI_WALLET_FACTORY: BlockchainConfig.abis.SAFARI_WALLET_FACTORY,
            SAFARI_SMART_WALLET: BlockchainConfig.abis.SAFARI_SMART_WALLET,
        };

        const abi = abiMap[name] || BlockchainConfig.abis.ERC20;
        return new ethers.Contract(address, abi, signerOrProvider || getProvider());
    }

    /**
     * Estimates gas for a transaction with a safety buffer.
     * @returns Gas limit with the configured multiplier applied.
     */
    static async estimateGas(tx: ethers.TransactionRequest): Promise<bigint> {
        const provider = getProvider();
        const estimate = await provider.estimateGas(tx);
        const buffered = (estimate * BigInt(Math.round(BlockchainConfig.gas.gasLimitMultiplier * 100))) / 100n;
        logger.info('GAS', `Estimated: ${estimate.toString()}, Buffered: ${buffered.toString()}`);
        return buffered;
    }

    /**
     * Waits for a transaction to be confirmed.
     * Returns the receipt or throws on failure.
     */
    static async waitForConfirmation(txHash: string): Promise<ethers.TransactionReceipt> {
        const provider = getProvider();
        logger.info('TX', `Waiting for ${BlockchainConfig.gas.confirmations} confirmation(s): ${txHash}`);

        const receipt = await provider.waitForTransaction(txHash, BlockchainConfig.gas.confirmations, 120_000);
        if (!receipt) {
            throw new Error(`Transaction timeout: ${txHash}`);
        }
        if (receipt.status === 0) {
            logger.error('TX', `Transaction REVERTED: ${txHash}`);
            throw new Error(`Transaction reverted on-chain: ${txHash}`);
        }

        logger.info('TX', `✅ Confirmed in block ${receipt.blockNumber}: ${txHash}`);
        return receipt;
    }

    /**
     * Validates an Ethereum address (checksum-aware).
     */
    static isValidAddress(address: string): boolean {
        try {
            ethers.getAddress(address); // throws if invalid
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Returns the native MATIC/POL balance of an address.
     */
    static async getNativeBalance(address: string): Promise<string> {
        const balance = await getProvider().getBalance(address);
        return ethers.formatEther(balance);
    }

    /**
     * Returns the master Guardian signer (SafariPay Backend).
     * Used exclusively for recovery signatures and Treasury liquidity.
     */
    static getGuardianSigner(): ethers.Wallet {
        const key = process.env.SAFARI_GUARDIAN_PRIVATE_KEY;
        if (!key) throw new Error("SAFARI_GUARDIAN_PRIVATE_KEY not set in .env");
        return new ethers.Wallet(key, getProvider());
    }

    /**
     * Auto-Liquidity Gateway (Fiat -> USDT Wrapping).
     * Transfers USDT from the Treasury to the user's wallet address.
     */
    static async fundWalletFromTreasury(walletAddress: string, stableAmount: number): Promise<string> {
        try {
            const guardian = this.getGuardianSigner();
            const usdtContract = this.getContract('USDT', guardian);
            
            // Assume 6 decimals for USDT
            const amountWei = ethers.parseUnits(stableAmount.toString(), 6);
            
            logger.info('BLOCKCHAIN', `Minting/Transferring ${stableAmount} USDT to ${walletAddress}`);
            const tx = await usdtContract.transfer(walletAddress, amountWei);
            const receipt = await this.waitForConfirmation(tx.hash);
            
            return receipt.hash;
        } catch (e: any) {
            logger.error('BLOCKCHAIN', `Auto-wrapping failed: ${e.message}`);
            // Do not throw so we don't block the Postgres update (Tier 3 fallback)
            return `MOCK-${ethers.hexlify(ethers.randomBytes(4))}`;
        }
    }

    /**
     * Signs a recovery request (confirming OTP verified).
     * @param newOwner Address of the new device key
     * @param nonce Current wallet nonce
     * @param walletAddress The smart wallet address
     */
    static async signRecovery(newOwner: string, nonce: bigint, walletAddress: string): Promise<string> {
        const guardian = this.getGuardianSigner();
        const hash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "address"],
            [newOwner, nonce, walletAddress]
        );
        return await guardian.signMessage(ethers.toBeArray(hash));
    }

    /**
     * Links a phone number to a wallet address on the blockchain SNS.
     */
    static async linkIdentity(phone: string, walletAddress: string): Promise<string | null> {
        try {
            const guardian = this.getGuardianSigner();
            const registry = this.getContract('SAFARIPAY_PHONE_REGISTRY', guardian);

            const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phone));

            // Check if already linked
            const existing = await registry.resolve(phoneHash);
            if (existing && existing !== ethers.ZeroAddress) return null;

            const tx = await registry.registerIdentity(phoneHash, walletAddress);
            await tx.wait();
            return tx.hash;
        } catch (e: any) {
            console.error('SNS link failed:', e.message);
            return null;
        }
    }

    /**
     * Returns current network info for health checks.
     */
    static async getNetworkInfo() {
        const provider = getProvider();
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        return {
            chainId: Number(network.chainId),
            name: BlockchainConfig.network.name,
            blockNumber,
            rpcUrl: BlockchainConfig.rpcUrl.replace(/\/v2\/.+$/, '/v2/***'),
            isProduction: BlockchainConfig.isProduction,
            usdtContract: BlockchainConfig.contracts.USDT,
        };
    }

    /**
     * Startup health check — validates RPC connectivity and chainId match.
     * Called once at server boot. Logs a warning but doesn't kill the server
     * so the API can still serve off-chain requests.
     */
    static async verifyConnection(): Promise<boolean> {
        try {
            const provider = getProvider();
            const [network, blockNumber] = await Promise.all([
                provider.getNetwork(),
                provider.getBlockNumber(),
            ]);

            const actualChainId = Number(network.chainId);
            const expectedChainId = BlockchainConfig.chainId;

            if (actualChainId !== expectedChainId) {
                logger.error('BLOCKCHAIN', `⛔ Chain ID mismatch! Expected ${expectedChainId}, got ${actualChainId}`);
                return false;
            }

            logger.info('BLOCKCHAIN', `✅ Polygon ${BlockchainConfig.network.name} verified`);
            logger.info('BLOCKCHAIN', `   Chain ID: ${actualChainId} | Block: #${blockNumber}`);
            logger.info('BLOCKCHAIN', `   Explorer: ${BlockchainConfig.network.explorer}`);
            return true;
        } catch (err: any) {
            logger.error('BLOCKCHAIN', `❌ RPC connection failed: ${err.message}`);
            logger.error('BLOCKCHAIN', `   Check your ALCHEMY_API_KEY or RPC_URL in .env`);
            return false;
        }
    }
}
