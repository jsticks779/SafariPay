import { StorageService } from '../services/storage.service';
import { logger } from './logger';

/**
 * Decentralized Storage Engine (Powered by Storacha / Filecoin)
 * Every financial event in SafariPay is anchored to the Filecoin network
 * using Storacha for immutable data persistence and transparency.
 */
export class IPFSService {
    /**
     * Upload JSON data to Storacha (returns CIDv1 in base32 format: bafy...)
     * Throws error if upload fails - caller should handle gracefully
     */
    static async uploadJSON(data: any): Promise<string> {
        logger.info('STORAGE', '🪐 Initializing decentralized storage via Storacha...');

        // Map generic data to ReceiptData structure
        const receiptData = {
            txHash: data.txHash || data.tx_id || `TX_${Date.now()}`,
            from: data.from || data.sender || 'Unknown',
            to: data.to || data.receiver || 'Unknown',
            amount: data.amount ? `${data.amount} ${data.currency || 'USDT'}` : 'N/A',
            timestamp: data.timestamp || new Date().toISOString(),
            network: data.network || 'Polygon'
        };

        // Will throw error if upload fails
        const cid = await StorageService.uploadReceipt(receiptData);
        
        logger.info('STORAGE', `✅ Receipt anchored to Filecoin: ${cid}`);
        logger.info('STORAGE', `🔗 View at: https://w3s.link/ipfs/${cid}`);
        
        return cid;
    }
}
