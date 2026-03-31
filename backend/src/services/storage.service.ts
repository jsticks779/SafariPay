import { logger } from '../utils/logger';

export class StorageService {
    private static client: any = null;
    private static space: any = null;

    /**
     * Lazy-loads the Storacha ESM client in our CommonJS environment
     */
    private static async getClient() {
        if (this.client) return this.client;

        try {
            // Validate credentials first
            const agentKey = process.env.W3_AGENT_KEY?.trim();
            const proofStr = process.env.W3_PROOF?.trim();
            
            if (!agentKey || !proofStr) {
                logger.warn('STORAGE', 'W3_AGENT_KEY or W3_PROOF missing - Storacha disabled. Returning null for mock CID fallback.');
                return null; // Signal to skip real upload and use mock
            }

            // Force dynamic ESM imports for CommonJS transpiler compatibility
            const { create } = await eval('import("@storacha/client")');
            const { Signer } = await eval('import("@ucanto/principal")');
            const { Delegation } = await eval('import("@ucanto/core/delegation")');
            const { CarReader } = await eval('import("@ipld/car")');

            // 1. Initialize Agent from local key
            const principal = Signer.from(agentKey);
            this.client = await create({ principal });

            // 2. Extract Delegation Proof
            const proofBytes = Buffer.from(proofStr, 'base64');
            const car = await CarReader.fromBytes(proofBytes);
            
            const blocks: any[] = [];
            for await (const block of car.blocks()) {
                blocks.push(block);
            }
            
            const delegation = Delegation.importDAG(blocks);
            if (!delegation) throw new Error('Failed to import delegation DAG from proof');
            
            await this.client.addProof(delegation);

            // 3. Find and set the 'samwel' space
            const spaces = this.client.spaces();
            this.space = spaces.find((s: any) => s.name === 'samwel');
            
            if (this.space) {
                await this.client.setCurrentSpace(this.space.did());
                logger.info('STORAGE', `Storacha Space '${this.space.name}' is now active.`);
            } else {
                logger.warn('STORAGE', 'Space "samwel" not found in delegation. Fallback to default.');
                if (spaces.length > 0) {
                    this.space = spaces[0];
                    await this.client.setCurrentSpace(this.space.did());
                } else {
                    throw new Error('No spaces found in authorized delegation.');
                }
            }

            return this.client;
        } catch (err: any) {
            logger.error('STORAGE', `Failed to initialize Storacha: ${err.message}. Using mock CID mode.`);
            return null; // Return null to trigger mock CID in uploadReceipt
        }
    }

    /**
     * Anchors a transaction receipt to Filecoin via Storacha
     * Returns CIDv1 (bafy...) format for w3s.link compatibility
     * Throws error if upload fails - caller should NOT show "View Receipt" button
     */
    static async uploadReceipt(data: any): Promise<string> {
        const client = await this.getClient();
        
        // If credentials are missing, throw error (don't return mock CID)
        if (!client) {
            throw new Error('Storage credentials not configured (W3_AGENT_KEY or W3_PROOF missing). Cannot upload receipt.');
        }

        try {
            const receipts = JSON.stringify(data);
            const blob = new Blob([receipts], { type: 'application/json' });
            const filename = `receipt_${data.txHash || Date.now()}.json`;
            
            logger.info('STORAGE', `📡 Uploading receipt to Storacha for ${data.txHash}...`);
            
            // Storacha v3 returns a CIDv1 in base32 format (starts with 'bafy...')
            const cid = await client.uploadFile(
                new File([blob], filename, { type: 'application/json' })
            );
            
            const cidString = String(cid);
            
            // Validate that we got a proper CIDv1 (bafy... or other base32 prefix)
            if (!cidString.startsWith('bafy')) {
                logger.warn('STORAGE', `Unexpected CID format from Storacha: ${cidString}`);
                // Even if unexpected format, return it if it looks like a valid CID
                if (cidString.match(/^ba[a-z2-7]{50,}/)) {
                    logger.info('STORAGE', `✅ Receipt anchored to Filecoin: ${cidString}`);
                    return cidString;
                }
                throw new Error(`Invalid CID format from Storacha: ${cidString}`);
            }
            
            logger.info('STORAGE', `✅ Receipt anchored to Filecoin: ${cidString}`);
            return cidString;
            
        } catch (e: any) {
            const errorMsg = `Storage upload failed: ${e.message}`;
            logger.error('STORAGE', errorMsg);
            // Throw error so transaction response knows this failed
            throw new Error(errorMsg);
        }
    }
}
