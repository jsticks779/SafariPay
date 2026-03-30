import { Router } from 'express';
import { InternationalController } from '../../controllers/international.controller';
import { FXService } from '../../services/fx.service';
import { auth } from '../../middleware/auth';
import pool from '../../db/database';
import { Responder } from '../../utils/responder';

const router = Router();

/**
 * @api /api/v1/transfer/international
 * @method POST
 */
router.post('/international', auth, InternationalController.transfer);

/**
 * @api /api/v1/transfer/fx-rates
 * @method GET
 */
router.get('/fx-rates', auth, async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to currencies required' });
        const { rate } = await FXService.convert(1, from as string, to as string);
        res.json({ from, to, rate: Number(rate.toFixed(6)) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @api /api/v1/transfer/request
 * @method POST
 */
router.post('/request', auth, async (req: any, res) => {
    try {
        const { amount_usdt, amount_local, local_currency, description, expires_at } = req.body;
        if (!amount_usdt) return Responder.error(res, 'Amount in USDT is required', 400);

        const { rows } = await pool.query(
            `INSERT INTO payment_requests (requester_id, amount_usdt, amount_local, local_currency, description, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, amount_usdt, amount_local, local_currency, description, expires_at]
        );

        return Responder.ok(res, rows[0]);
    } catch (e: any) {
        return Responder.error(res, e.message);
    }
});

/**
 * @api /api/v1/transfer/request/:id
 * @method GET (Public)
 */
router.get('/request/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `SELECT pr.*, u.name as requester_name, u.wallet_address as requester_wallet
             FROM payment_requests pr
             JOIN users u ON pr.requester_id = u.id
             WHERE pr.id = $1`,
            [id]
        );

        if (!rows.length) return Responder.error(res, 'Payment request not found', 404);
        return Responder.ok(res, rows[0]);
    } catch (e: any) {
        return Responder.error(res, e.message);
    }
});

/**
 * @api /api/v1/transfer/request/:id/pay
 * @method POST
 * Marks a payment request as paid. Called after the payer's transfer succeeds.
 */
router.post('/request/:id/pay', auth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { tx_hash } = req.body;

        const { rows } = await pool.query(
            `UPDATE payment_requests
             SET status = 'paid', payer_id = $1, tx_hash = $2, paid_at = NOW()
             WHERE id = $3 AND status = 'pending'
             RETURNING *`,
            [req.user.id, tx_hash || null, id]
        );

        if (!rows.length) {
            return Responder.error(res, 'Payment request not found or already paid', 404);
        }

        return Responder.ok(res, rows[0]);
    } catch (e: any) {
        return Responder.error(res, e.message);
    }
});

export default router;
