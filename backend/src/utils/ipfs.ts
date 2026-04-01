import { logger } from '../utils/logger';

export class StorageService {
    private static client: any = null;
    private static space: any = null;

    private static async getClient() {
        if (this.client) return this.client;

        try {
            const agentKey = process.env.W3_AGENT_KEY?.trim();
            const proofStr = process.env.W3_PROOF?.trim();

            if (!agentKey || !proofStr) {
                logger.warn('STORAGE', 'W3_AGENT_KEY or W3_PROOF missing in .env');
                return null;
            }

            // Dynamic Imports for CommonJS
            const { create } = await eval('import("@storacha/client")');
            const { parse } = await eval('import("@ucanto/principal/ed25519")');
            const { Delegation } = await eval('import("@ucanto/core/delegation")');

            // 1. Initialize Agent using the DID Key
            // Badala ya Signer.from, tunatumia parse kwa ajili ya did:key
            const principal = parse(agentKey);
            this.client = await create({ principal });

            // 2. Extract Delegation Proof from Base64
            const proofBytes = Buffer.from(proofStr, 'base64');
            const delegation = await Delegation.extract(proofBytes);

            if (!delegation.ok) {
                throw new Error(`Failed to extract delegation: ${delegation.error?.message}`);
            }

            // 3. Add the proof to the client
            await this.client.addSpace(delegation.ok);

            // 4. Set current space
            // Tunachukua space DID moja kwa moja kutoka kwenye delegation proof
            const spaceDid = delegation.ok.capabilities[0].with;
            await this.client.setCurrentSpace(spaceDid);

            logger.info('STORAGE', `✅ Storacha Space is now active: ${spaceDid}`);

            return this.client;
        } catch (err: any) {
            logger.error('STORAGE', `Initialization Failed: ${err.message}`);
            return null;
        }
    }

    static async uploadReceipt(data: any): Promise<string> {
        const client = await this.getClient();

        if (!client) {
            throw new Error('Storage credentials not configured correctly.');
        }

        try {
            const receiptJson = JSON.stringify(data);
            // Kwenye Node.js, tunatumia Blob kutoka 'buffer' au global
            const blob = new Blob([receiptJson], { type: 'application/json' });
            const filename = `receipt_${data.txHash || Date.now()}.json`;
            const file = new File([blob], filename, { type: 'application/json' });

            logger.info('STORAGE', `📡 Uploading to Filecoin/IPFS...`);

            // UploadFile inarudisha CID object
            const cid = await client.uploadFile(file);
            const cidString = cid.toString();

            logger.info('STORAGE', `✅ Receipt anchored: ${cidString}`);
            return cidString;

        } catch (e: any) {
            logger.error('STORAGE', `Upload failed: ${e.message}`);
            throw new Error(`Storage upload failed: ${e.message}`);
        }
    }
}