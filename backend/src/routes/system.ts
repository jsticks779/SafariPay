import { Router, Response } from 'express';
import { SmsService } from '../services/sms_logger.service';
import { BlockchainService } from '../services/blockchain.service';
import { BlockchainConfig } from '../config/blockchain.config';

const router = Router();

// GET /api/v1/system/sms-logs
router.get('/sms-logs', async (req, res) => {
    // Note: getLogs() no longer exists, but for the global route we'll fetch all or just use a generic list
    // To keep it simple, we'll fetch all recent ones from the store
    const { rows } = await require('../db/database').default.query(`SELECT recipient_phone as to, message, msg_type as type, channel, created_at as timestamp FROM system_messages ORDER BY created_at DESC LIMIT 100`);
    res.json(rows);
});

router.get('/sms-logs/:phone', async (req, res) => {
    res.json(await SmsService.getLogsByPhone(req.params.phone));
});

// DELETE /api/v1/system/sms-logs (Clean up)
router.delete('/sms-logs', async (req, res) => {
    await SmsService.clearLogs();
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

router.post('/confirm-payment/:txHash', async (req, res) => {
    const { txHash } = req.params;
    const pool = require('../db/database').default;
    
    try {
        await pool.query('BEGIN');
        
        // 1. Fetch pending transaction
        const { rows: tR } = await pool.query(
            `SELECT * FROM bridge_transactions WHERE tx_hash = $1 AND status = 'PENDING'`,
            [txHash]
        );
        
        if (tR.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending transaction not found or already processed' });
        }
        
        const tx = tR[0];
        
        // 2. Update Transaction to SUCCESS
        await pool.query(
            `UPDATE bridge_transactions SET status = 'SUCCESS' WHERE id = $1`,
            [tx.id]
        );
        
        // 3. Credit user balance
        await pool.query(
            `UPDATE users SET balance = balance + $1 WHERE id = $2`,
            [tx.amount_fiat, tx.user_id]
        );
        
        // 4. Send Notifications (The grand finale)
        const { rows: uR } = await pool.query('SELECT name, phone FROM users WHERE id=$1', [tx.user_id]);
        if (uR.length > 0) {
            const user = uR[0];
            const amountStr = Number(tx.amount_fiat).toLocaleString();
            
            // Step 4.1: Identify the realistic network sender
            let networkSender = 'M-PESA';
            if (tx.params?.provider) {
               networkSender = tx.params.provider.toUpperCase();
            }

            // Network confirmation (e.g. from M-PESA or Airtel)
            await SmsService.sendSms(user.phone, `${txHash} Confirmed. TZS ${amountStr} received from SAFARIPAY. Ref: ${txHash}.`, 'TRANSACTION', networkSender);
            
            // SafariPay congratulations
            await SmsService.sendSms(user.phone, `Congratulations ${user.name}! Your SafariPay account has been credited with TZS ${amountStr}. Digital currency is now in your hands!`, 'SYSTEM', 'SAFARIPAY');
        }

        await pool.query('COMMIT');
        res.json({ success: true, message: 'Payment confirmed and balance credited' });
    } catch (e: any) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

export default router;
