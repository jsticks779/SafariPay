import { Router, Request, Response } from 'express';
import { paymentBridge } from '../services/PaymentBridge';
import { auth, AuthRequest } from '../middleware/auth';
import { Responder } from '../utils/responder';

const router = Router();

// Test Webhook for simulating incoming mobile money
router.post('/sandbox/webhook/onramp', async (req: Request, res: Response): Promise<void> => {
    try {
        const { amount, phone, userId } = req.body;

        if (!amount || !phone || !userId) {
            res.status(400).json({ error: 'Missing required fields: amount, phone, userId' });
            return;
        }

        const success = await paymentBridge.processOnRamp(amount, phone, userId);

        if (success) {
            res.json({ message: 'Sandbox On-Ramp Successful. Webhook processed.', status: 'Success' });
        } else {
            res.status(500).json({ error: 'Sandbox On-Ramp Failed' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint for simulating an offramp withdrawal
router.post('/sandbox/withdraw/offramp', auth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { amountUsdt, phone } = req.body;

        if (!amountUsdt || !phone) {
            res.status(400).json({ error: 'Missing required fields: amountUsdt, phone' });
            return;
        }

        // Use the authenticated user's ID
        const userId = req.user!.id;
        const success = await paymentBridge.processOffRamp(amountUsdt, phone, userId);

        if (success) {
            res.json({ message: 'Sandbox Off-Ramp Successful. B2C Transfer triggered.', status: 'Success' });
        } else {
            res.status(500).json({ error: 'Sandbox Off-Ramp Failed' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to quickly check the bridge mode and current rate
router.get('/status', async (req: Request, res: Response): Promise<void> => {
    try {
        const rate = await paymentBridge.getUsdtRate();
        res.json({
            bridgeMode: process.env.NODE_ENV === 'production' ? 'MAINNET' : 'TESTNET',
            currentRate: `1 USDT = ${rate} TZS`
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint for frontend to trigger an STK Push (Deposit)
router.post('/stkpush/onramp', auth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { amount, phone, currency } = req.body;
        // Support both old 'amountTzs' and new 'amount' fields
        const localAmount = amount || req.body.amountTzs;

        if (!localAmount || !phone) {
            res.status(400).json({ error: 'Missing required fields: amount, phone' });
            return;
        }

        const userId = req.user!.id;

        // 🌍 [Localization] If deposit is non-TZS, normalize to TZS internal base via USDT
        // This ensures the portfolio balance remains consistent across regions
        let normalizedTzs = localAmount;
        if (currency && currency !== 'TZS') {
            const { FXService } = require('../services/fx.service');
            const rate = await FXService.getLiveRate(currency);
            const usdt = localAmount / rate;
            normalizedTzs = usdt * 2500; // Normalize to TZS (internal store base)
        }

        const success = await paymentBridge.processOnRamp(normalizedTzs, phone, userId);

        if (success) {
            res.json({
                message: `Deposit of ${localAmount} ${currency || 'TZS'} initialized! USDT credited to your wallet.`,
                status: 'Success'
            });
        } else {
            res.status(500).json({ error: 'STK Push failed.' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


export default router;
