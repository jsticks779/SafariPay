import { Router, Request, Response } from 'express';
import pool from '../db/database';
import { AuthRequest, auth } from '../middleware/auth';
import { FXService } from '../services/fx.service';

const router = Router();

// Simple Admin Check Middleware
const isAdmin = (req: AuthRequest, res: Response, next: Function) => {
    if ((req.user as any)?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied. Admin only.' });
        return;
    }
    next();
};

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Unprotected Admin Login/Setup Route
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { secret } = req.body;
        
        // Hardcoded admin secret for the demo presentation
        if (secret !== 'admin123') {
            res.status(401).json({ error: 'Invalid admin credentials' });
            return;
        }

        const adminPayload = { id: 'admin', role: 'admin', is_active: true };

        // Generate the Isolated Admin JWT Token (Does not touch PostgreSQL users DB)
        const token = jwt.sign(adminPayload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        
        res.json({ user: adminPayload, token });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.use(auth);
router.use(isAdmin);

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Mocking USDT Processed by calculating total cross_border volume / 2850
        const { rows: txRows } = await pool.query(`SELECT SUM(amount) as total FROM transactions`);
        const totalVolumeTzs = txRows[0].total || 0;
        const totalUsdtProcessed = (totalVolumeTzs / 2850).toFixed(2);

        const { rows: ioRows } = await pool.query(`SELECT SUM(amount) as total FROM transactions WHERE type IN ('local', 'cross_border')`);
        const totalTzsOutflow = ioRows[0].total || 0;

        const { rows: loanRows } = await pool.query(`SELECT COUNT(*) as active FROM loans WHERE status = 'active'`);
        const activeLoans = loanRows[0].active || 0;

        const { rows: kycRows } = await pool.query(`SELECT COUNT(*) as pending FROM users WHERE kyc_status = 'pending'`);
        const pendingKyc = kycRows[0].pending || 0;

        res.json({
            totalUsdtProcessed,
            totalTzsOutflow,
            activeLoans,
            pendingKyc
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { rows } = await pool.query(`
            SELECT id, name, phone, wallet_address, credit_score, kyc_status 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/exchange-rate', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { rate, currency } = req.body;
        if (!rate || !currency) {
            res.status(400).json({ error: 'Rate and currency (e.g. TZS) required' });
            return;
        }

        // Initialize table if it doesn't exist just in case (fx.service uses it)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exchange_rates (
                base_currency VARCHAR(10) DEFAULT 'USD',
                target_currency VARCHAR(10),
                rate DECIMAL(18,4),
                last_updated TIMESTAMPTZ,
                PRIMARY KEY (base_currency, target_currency)
            )
        `);

        // Insert or update with a very futuristic date to "override" FX cache for the demo
        await pool.query(`
            INSERT INTO exchange_rates (target_currency, rate, last_updated)
            VALUES ($1, $2, NOW() + INTERVAL '100 days')
            ON CONFLICT (base_currency, target_currency) 
            DO UPDATE SET rate = EXCLUDED.rate, last_updated = EXCLUDED.last_updated
        `, [currency, rate]);

        res.json({ message: 'Global exchange rate updated successfully', rate });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
