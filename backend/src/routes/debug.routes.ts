import { Router, Request, Response } from 'express';
import { paymentBridge } from '../services/PaymentBridge';
import { StorageService } from '../services/storage.service';
import { logger } from '../utils/logger';
import { Responder } from '../utils/responder';

const router = Router();

/** Test Storacha Integration */
router.get('/storage-test', async (req: Request, res: Response) => {
    try {
        const testData = { project: "SafariPay", status: "Live Test", time: new Date().toISOString() };
        const cid = await StorageService.uploadReceipt(testData);
        return Responder.ok(res, {
            message: 'Storacha Connection Successful',
            cid,
            url: `https://w3s.link/ipfs/${cid}`
        });
    } catch (e: any) {
        // FIX: Changed 'DEBUG' to 'API' to match LogCategory types
        logger.error('API', `Storage Test Failure: ${e.message}`);
        return res.status(500).json({ success: false, error: e.message });
    }
});

/** DEBUG ON-RAMP SIMULATOR */
router.post('/onramp', async (req: Request, res: Response): Promise<void> => {
    try {
        const { amountTzs, phone, userId } = req.body;
        if (!amountTzs || !phone || !userId) {
            res.status(400).json({ error: 'Missing debug fields' });
            return;
        }
        const success = await paymentBridge.processOnRamp(amountTzs, phone, userId);
        if (success) {
            res.json({ message: 'Debug On-Ramp successful', userId });
        } else {
            res.status(500).json({ error: 'Bridge execution failed' });
        }
    } catch (e: any) {
        logger.error('API', 'Debug On-Ramp Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;