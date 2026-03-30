import { Router, Request, Response } from 'express';
import { paymentBridge } from '../services/PaymentBridge';
import { logger } from '../utils/logger';

const router = Router();

/**
 * DEBUG ON-RAMP SIMULATOR
 * =======================
 * Use this to manually trigger a successful On-Ramp without real Mobile Money.
 * Simulates the callback/webhook SafariPay expects from Africa's Talking.
 */
router.post('/onramp', async (req: Request, res: Response): Promise<void> => {
    try {
        const { amountTzs, phone, userId } = req.body;

        if (!amountTzs || !phone || !userId) {
            res.status(400).json({ error: 'Missing debug fields: amountTzs, phone, userId' });
            return;
        }

        console.log(`\n🧪 [DEBUG TESTNET] Simulating Africa's Talking Callback for User: ${userId}`);

        // Directly invoke the bridge's on-ramp logic
        const success = await paymentBridge.processOnRamp(amountTzs, phone, userId);

        if (success) {
            res.json({
                message: 'Debug On-Ramp successful. Assets credited to reward_balance.',
                simulatedPayload: {
                    provider: 'DEBUG_GATEWAY',
                    status: 'Success',
                    value: `TZS ${amountTzs}`,
                    userId: userId
                }
            });
        } else {
            res.status(500).json({ error: 'Bridge execution failed during debug simulation.' });
        }

    } catch (e: any) {
        logger.error('API', 'Debug On-Ramp Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;
