import { logger } from '../utils/logger';

/**
 * StorageService: Manages decentralized receipt anchoring on Storacha (Web3.Storage v2).
 * Attempts real upload to IPFS/Filecoin, handles failures gracefully.
 * 
 * ⚠️ KEY FORMAT REQUIREMENTS:
 * - W3_AGENT_KEY: Must be a Storacha Secret Key (starts with 'M'), not a DID
 *   Get from: https://app.web3.storage → API Tokens → Create Token
 * - W3_PROOF: Base64-encoded delegation proof (optional but recommended)
 */
export class StorageService {
    private static client: any = null;
    private static initAttempted = false;

    /**
     * Validate key format and provide helpful diagnostics
     */
    private static validateKeyFormat(key: string): { valid: boolean; format: string; warning?: string } {
        if (key.startsWith('M')) {
            return { valid: true, format: 'Secret Key ✅' };
        } else if (key.startsWith('did:key:')) {
            return { 
                valid: false, 
                format: 'DID ❌', 
                warning: 'DIDs are not valid Storacha keys. Please use a Web3.Storage Secret Key from app.web3.storage'
            };
        } else if (key.length > 60) {
            return { 
                valid: false, 
                format: 'Unknown (long string) ❌',
                warning: 'Key format unrecognized. Secret Keys start with "M"'
            };
        }
        return { valid: false, format: 'Unknown ❌', warning: 'Invalid key format' };
    }

    /**
     * Initialize Storacha client with Web3.Storage v2 credentials
     */
    private static async getClient() {
        if (this.client) return this.client;
        if (this.initAttempted) return null; // Don't retry if already failed

        this.initAttempted = true;

        try {
            const agentKey = process.env.W3_AGENT_KEY?.trim();
            const proofStr = process.env.W3_PROOF?.trim();

            if (!agentKey || !proofStr) {
                logger.error('STORAGE', '❌ Missing credentials:');
                if (!agentKey) logger.error('STORAGE', '   - W3_AGENT_KEY not set (need Web3.Storage Secret Key from app.web3.storage)');
                if (!proofStr) logger.error('STORAGE', '   - W3_PROOF not set (need delegation proof from Web3.Storage)');
                return null;
            }

            // Validate key format
            const keyValidation = this.validateKeyFormat(agentKey);
            logger.info('STORAGE', `Key format: ${keyValidation.format}`);
            if (keyValidation.warning) {
                logger.error('STORAGE', `⚠️  ${keyValidation.warning}`);
            }

            // Use dynamic import with proper ESM support
            const { create } = await import('@storacha/client');
            
            logger.info('STORAGE', `Initializing Storacha client with key: ${agentKey.substring(0, 15)}...`);
            
            // Create client - pass the Secret Key as the principal
            this.client = await create({
                principal: agentKey
            });

            // Try to add the delegation proof
            try {
                const { Delegation } = await import('@ucanto/core/delegation');
                const proofBytes = Buffer.from(proofStr, 'base64');
                const delegation = await Delegation.extract(proofBytes);

                if (delegation.ok) {
                    await this.client.addSpace(delegation.ok);
                    const spaceDid = delegation.ok.capabilities[0]?.with;
                    if (spaceDid) {
                        await this.client.setCurrentSpace(spaceDid);
                        logger.info('STORAGE', `✅ Space set: ${spaceDid.substring(0, 30)}...`);
                    }
                    logger.info('STORAGE', '✅ Storacha client ready with delegation');
                } else {
                    logger.warn('STORAGE', 'Could not extract delegation from proof');
                }
            } catch (delegErr: any) {
                logger.warn('STORAGE', `Delegation setup warning: ${delegErr.message}`);
            }

            logger.info('STORAGE', '✅ Storacha client initialized successfully');
            return this.client;

        } catch (err: any) {
            logger.error('STORAGE', `❌ Storacha initialization failed:`);
            logger.error('STORAGE', `   Error: ${err.message}`);
            logger.error('STORAGE', `   Stack: ${err.stack?.split('\n').slice(0, 3).join('\n')}`);
            logger.error('STORAGE', `\n📋 TROUBLESHOOTING:`);
            logger.error('STORAGE', `   1. Go to https://app.web3.storage`);
            logger.error('STORAGE', `   2. Create a new API Token in Settings`);
            logger.error('STORAGE', `   3. Copy the Secret Key (starts with 'M') to W3_AGENT_KEY in .env`);
            logger.error('STORAGE', `   4. Export the delegation proof as base64 and set W3_PROOF`);
            logger.error('STORAGE', `   5. Restart the backend`);
            logger.error('STORAGE', `\n⚠️  Receipts will NOT be stored, but transactions will continue normally`);
            return null;
        }
    }

    /**
     * Upload receipt to IPFS via Storacha
     * Returns CID on success, null on failure (doesn't break transactions)
     * 
     * Success response includes receipt CID that can be accessed at https://w3s.link/ipfs/{CID}
     */
    static async uploadReceipt(data: any): Promise<string | null> {
        try {
            const client = await this.getClient();
            if (!client) {
                logger.debug('STORAGE', 'Client unavailable, skipping receipt upload');
                return null;
            }

            const receiptJson = JSON.stringify(data, null, 2);
            const blob = new Blob([receiptJson], { type: 'application/json' });
            const filename = `safari_receipt_${data.txHash || Date.now()}.json`;
            const file = new File([blob], filename, { type: 'application/json' });

            logger.info('STORAGE', `📤 Uploading receipt: ${filename} (${blob.size} bytes)`);
            const cid = await client.uploadFile(file);
            const cidString = cid.toString();

            logger.info('STORAGE', `✅ Receipt stored! CID: ${cidString}`);
            logger.info('STORAGE', `   🔗 View at: https://w3s.link/ipfs/${cidString}`);
            return cidString;

        } catch (e: any) {
            logger.error('STORAGE', `❌ Upload failed: ${e.message}`);
            logger.debug('STORAGE', `   Details: ${e.stack?.split('\n')[0] || e.toString()}`);
            return null;
        }
    }
}