/**
 * SafariPay — OTP Service (Production-Ready)
 * ===========================================
 * Handles generating, hashing, storing, sending, and verifying 
 * Phone OTPs (One-Time Passwords).
 * Enforces rate limiting (max 3 attempts) and 5-minute expiration.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../db/database';
import { SmsService } from './sms_logger.service';
import { logger } from '../utils/logger';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 3;

export class OtpService {
    /**
     * Generates a 6-digit numeric code.
     */
    private static generateCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Creates and sends a new OTP for a given phone number.
     * Upserts into the `otps` table.
     */
    static async sendOtp(phone: string, purpose: string = 'Verification', metadata: any = {}): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const code = this.generateCode();
            const code_hash = await bcrypt.hash(code, 10);
            const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

            // Upsert the OTP
            await client.query(`
                INSERT INTO otps (phone, code_hash, expires_at, attempts, created_at, metadata)
                VALUES ($1, $2, $3, 0, NOW(), $4)
                ON CONFLICT (phone) DO UPDATE 
                SET code_hash = EXCLUDED.code_hash, 
                    expires_at = EXCLUDED.expires_at, 
                    attempts = 0,
                    created_at = NOW(),
                    metadata = $4
            `, [phone, code_hash, expires_at, JSON.stringify(metadata)]);

            // Simulate sending SMS via the gateway
            const message = `${purpose}: Your SafariPay security code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. DO NOT share this with anyone.`;
            await SmsService.sendSms(phone, message, 'OTP');

            await client.query('COMMIT');
            logger.info('SECURITY', `OTP sent to ${phone}`);
        } catch (err: any) {
            await client.query('ROLLBACK');
            logger.error('SECURITY', `Failed to send OTP to ${phone}: ${err.message}`);
            throw new Error('Failed to generate OTP');
        } finally {
            client.release();
        }
    }

    /**
     * Verifies a provided OTP code and returns its metadata.
     */
    static async verifyOtpWithMetadata(phone: string, providedCode: string): Promise<{ valid: boolean; metadata?: any }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows } = await client.query('SELECT * FROM otps WHERE phone = $1 FOR UPDATE', [phone]);
            if (rows.length === 0) {
                await client.query('ROLLBACK');
                throw new Error('No active OTP found for this number');
            }

            const otpRecord = rows[0];

            if (new Date() > new Date(otpRecord.expires_at)) {
                await client.query('DELETE FROM otps WHERE phone = $1', [phone]);
                await client.query('COMMIT');
                throw new Error('OTP has expired. Please request a new one.');
            }

            if (otpRecord.attempts >= MAX_ATTEMPTS) {
                await client.query('DELETE FROM otps WHERE phone = $1', [phone]);
                await client.query('COMMIT');
                throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
            }

            const isValid = await bcrypt.compare(providedCode, otpRecord.code_hash);

            if (!isValid) {
                const attemptsLeft = MAX_ATTEMPTS - (otpRecord.attempts + 1);
                await client.query('UPDATE otps SET attempts = attempts + 1 WHERE phone = $1', [phone]);
                await client.query('COMMIT');
                if (attemptsLeft <= 0) throw new Error('Maximum verification attempts exceeded.');
                throw new Error(`Invalid OTP. You have ${attemptsLeft} attempts remaining.`);
            }

            await client.query('DELETE FROM otps WHERE phone = $1', [phone]);
            await client.query('COMMIT');

            logger.info('SECURITY', `OTP successfully verified for ${phone}`);
            return { valid: true, metadata: otpRecord.metadata };

        } catch (err: any) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Verifies a provided OTP code for a given phone.
     */
    static async verifyOtp(phone: string, providedCode: string): Promise<boolean> {
        const res = await this.verifyOtpWithMetadata(phone, providedCode);
        return res.valid;
    }
}
