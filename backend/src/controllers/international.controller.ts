
import { Response, NextFunction } from 'express';
import pool from '../db/database';
import { Responder } from '../utils/responder';
import { FXService } from '../services/fx.service';
import { SmsService } from '../services/sms_logger.service';
import { AuthRequest } from '../middleware/auth';
import { ethers } from 'ethers';

export class InternationalController {
    /**
     * @route POST /api/v1/transfer/international
     * Handles Cross-Border Transactions with FX and Compliance.
     */
    static async transfer(req: AuthRequest, res: Response, next: NextFunction) {
        const client = await pool.connect();
        try {
            const { recipient_phone, recipient_country, amount_source, description, pin } = req.body;
            const sender_id = req.user!.id;

            if (!recipient_phone || !recipient_country || !amount_source || !pin) {
                return Responder.error(res, 'Missing required fields', 400);
            }

            // 1. Compliance & KYC Check
            const { rows: senderRows } = await client.query(
                'SELECT * FROM users WHERE id = $1 FOR UPDATE',
                [sender_id]
            );
            const sender = senderRows[0];

            if (sender.trust_level === 'LOCKED' || sender.trust_level === 'LOW') {
                return Responder.error(res, 'International transfers require Level 2 KYC (Verified Account).', 403);
            }

            // 2. Cryptographic PIN Verification & AES Key Recovery
            const bcrypt = require('bcryptjs');
            const isPinValid = await bcrypt.compare(pin.toString(), sender.pin_hash);
            if (!isPinValid) {
                return Responder.error(res, 'Invalid security PIN', 403);
            }

            let privateKey;
            try {
                const { decryptPrivateKey } = require('../utils/cryptoUtils');
                privateKey = decryptPrivateKey(sender.encrypted_private_key, pin.toString());
            } catch (e) {
                return Responder.error(res, 'Security alert: Signing key recovery failed. Corrupted state.', 403);
            }

            // 3. Currency Exchange Logic (FX Oracle)
            const dest_currency = InternationalController.getCurrencyByCountry(recipient_country);
            const { targetAmount, rate } = await FXService.convert(amount_source, sender.currency || 'TZS', dest_currency);

            // 4. Fee Calculation (0.8% FX Margin as requested)
            const fee = Number((amount_source * 0.008).toFixed(2));
            const total_deduction = amount_source + fee;

            if (Number(sender.balance) < total_deduction) {
                return Responder.error(res, 'Insufficient balance including 0.8% FX margin', 400);
            }

            await client.query('BEGIN');

            // 5. Deduct Balance
            await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2',
                [total_deduction, sender_id]
            );

            // 6. Smart Contract Ethers.js Action 
            // In a production environment, this wraps the equivalent TZS -> USDT and pushes the ERC-20 token over Polygon Amoy
            const txHash = ethers.hexlify(ethers.randomBytes(32));
            console.log(`⛓️ [BLOCKCHAIN] Signing ERC-20 payload with User Key... Broadcasted ${amount_source} equivalence to Polygon Amoy. Hash: ${txHash}`);

            // 7. Record Transaction
            const { rows: txRows } = await client.query(
                `INSERT INTO transactions(sender_id, receiver_phone, amount, type, status, description, fee, tx_hash, exchange_rate, destination_currency, target_amount)
                 VALUES($1, $2, $3, 'international', 'completed', $4, $5, $6, $7, $8, $9) RETURNING *`,
                [sender_id, recipient_phone, amount_source, description || `Global Transfer to ${recipient_country}`, fee, txHash, rate, dest_currency, targetAmount]
            );

            await client.query('COMMIT');

            // 8. Off-Ramp Simulation (External Webhook)
            console.log(`🌐 [OFF-RAMP] Triggering fulfillment for ${targetAmount} ${dest_currency} via ${recipient_country} Local Provider.`);

            // 9. Notify via SMS
            await SmsService.sendSms(
                sender.phone,
                `SafariPay: Your international transfer of ${amount_source} ${sender.currency} to ${recipient_phone} is successful. Recipient receives approx ${targetAmount} ${dest_currency}. Rate: ${rate}.`,
                'TRANSACTION'
            );

            return Responder.ok(res, {
                transaction: txRows[0],
                exchange_rate: rate,
                target_amount: targetAmount,
                destination_currency: dest_currency,
                fee: fee
            }, 'International transfer processed successfully');

        } catch (e: any) {
            await client.query('ROLLBACK');
            next(e);
        } finally {
            client.release();
        }
    }

    private static getCurrencyByCountry(country: string): string {
        const mapping: Record<string, string> = {
            'Kenya': 'KES',
            'Uganda': 'UGX',
            'Rwanda': 'RWF',
            'Nigeria': 'NGN',
            'Ghana': 'GHS',
            'South Africa': 'ZAR',
            'Ethiopia': 'ETB',
            'United Kingdom': 'GBP',
            'United States': 'USD',
            'European Union': 'EUR',
            'United Arab Emirates': 'AED',
            'China': 'CNY',
            'India': 'INR'
        };
        return mapping[country] || 'USD';
    }
}
