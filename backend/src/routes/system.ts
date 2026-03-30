import { Router, Response } from 'express';
import { SmsService } from '../services/sms_logger.service';
import { BlockchainService } from '../services/blockchain.service';
import { BlockchainConfig } from '../config/blockchain.config';

const router = Router();

// GET /api/v1/system/sms-logs
router.get('/sms-logs', (req, res) => {
    res.json(SmsService.getLogs());
});

// DELETE /api/v1/system/sms-logs (Clean up)
router.delete('/sms-logs', (req, res) => {
    SmsService.clearLogs();
    res.json({ success: true });
});

// GET /api/v1/system/blockchain-health
// Returns current Polygon network status, chain ID, and block number
router.get('/blockchain-health', async (req, res) => {
    try {
        const info = await BlockchainService.getNetworkInfo();
        res.json({
            status: 'connected',
            ...info,
            mode: BlockchainConfig.isProduction ? 'MAINNET' : 'TESTNET',
            explorer: BlockchainConfig.network.explorer,
        });
    } catch (e: any) {
        res.status(503).json({
            status: 'disconnected',
            error: e.message,
            expectedNetwork: BlockchainConfig.network.name,
            expectedChainId: BlockchainConfig.chainId,
            rpcUrl: BlockchainConfig.rpcUrl.replace(/\/v2\/.+$/, '/v2/***'),
        });
    }
});

export default router;
