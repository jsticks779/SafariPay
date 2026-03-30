/**
 * SafariPay — Wallet Routes (Recovery & Balance)
 * =================================================
 * Endpoints:
 *   GET  /wallet/balance          — Full balance (on-chain + off-chain)
 *   POST /wallet/recovery/setup   — Setup social recovery guardians
 *   POST /wallet/recovery/initiate — Start recovery process
 *   POST /wallet/recovery/approve  — Guardian approves recovery
 *   POST /wallet/recovery/seed     — Recover from seed phrase
 */

import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { WalletService } from '../services/wallet.service';
import { Responder } from '../utils/responder';
import pool from '../db/database';

const router = Router();

// ─── Authenticated Routes ───────────────────────────────────────────
router.get('/balance', auth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { rows } = await pool.query(
            'SELECT wallet_address, balance, reward_balance FROM users WHERE id = $1',
            [req.user!.id]
        );
        if (!rows.length) { res.status(404).json({ error: 'User not found' }); return; }

        const user = rows[0];
        const fullBalance = await WalletService.getFullBalance(
            user.wallet_address,
            Number(user.balance)
        );

        res.json({
            ...fullBalance,
            rewardBalance: Number(user.reward_balance),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/recovery/setup', auth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { guardians } = req.body; // Array of phone numbers
        if (!guardians || !Array.isArray(guardians)) {
            res.status(400).json({ error: 'Provide an array of 2-3 guardian phone numbers' });
            return;
        }

        await WalletService.setupGuardians(req.user!.id, guardians);
        res.json({ success: true, message: `${guardians.length} guardians registered for social recovery` });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.get('/recovery/guardians', auth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { rows } = await pool.query(
            "SELECT guardian_phone, status, created_at FROM social_recovery WHERE user_id = $1",
            [req.user!.id]
        );
        res.json({ guardians: rows });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Public Recovery Routes (No auth needed — user is locked out) ───
router.post('/recovery/initiate', async (req: any, res: Response): Promise<void> => {
    try {
        const { phone } = req.body;
        if (!phone) { res.status(400).json({ error: 'Phone number required' }); return; }

        const result = await WalletService.initiateRecovery(phone);
        res.json({
            ...result,
            message: `Recovery initiated. ${result.guardiansNotified} guardians have been notified. Ask them to approve.`
        });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/recovery/approve', async (req: any, res: Response): Promise<void> => {
    try {
        const { recoveryId, guardianPhone } = req.body;
        if (!recoveryId || !guardianPhone) {
            res.status(400).json({ error: 'recoveryId and guardianPhone required' });
            return;
        }

        const result = await WalletService.approveRecovery(recoveryId, guardianPhone);
        res.json({
            ...result,
            message: result.unlocked
                ? '🎉 Recovery approved! Majority reached. Account is now recoverable.'
                : '✅ Your approval has been recorded. Waiting for more guardians.'
        });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/recovery/seed', async (req: any, res: Response): Promise<void> => {
    try {
        const { mnemonic, newPin, phone } = req.body;
        if (!mnemonic || !newPin || !phone) {
            res.status(400).json({ error: 'mnemonic, newPin, and phone are required' });
            return;
        }

        const recovered = WalletService.recoverFromMnemonic(mnemonic, newPin);

        // Verify the recovered address matches the stored one
        const { rows } = await pool.query('SELECT wallet_address FROM users WHERE phone = $1', [phone]);
        if (!rows.length) { res.status(404).json({ error: 'Account not found' }); return; }

        if (rows[0].wallet_address.toLowerCase() !== recovered.address.toLowerCase()) {
            res.status(403).json({ error: 'Seed phrase does not match this account' });
            return;
        }

        // Update with new encrypted key
        const bcrypt = require('bcryptjs');
        const pin_hash = await bcrypt.hash(newPin, 10);
        await pool.query(
            'UPDATE users SET encrypted_private_key = $1, pin_hash = $2 WHERE phone = $3',
            [recovered.encryptedPrivateKey, pin_hash, phone]
        );

        res.json({ success: true, message: 'Wallet recovered successfully! You can now log in with your new PIN.' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
