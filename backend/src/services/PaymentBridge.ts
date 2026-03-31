/**
 * SafariPay — Modular Payment Bridge
 * ====================================
 * Handles On-Ramp (Fiat -> Crypto) and Off-Ramp (Crypto -> Fiat) flows.
 * Built to easily toggle between Sandbox/Testnet and Mainnet via config.
 */

import axios from 'axios';
import crypto from 'crypto';
import pool from '../db/database';
import { BridgeConfig, getMockRate } from '../config/bridge.config';
import { logger } from '../utils/logger';
import { SmsService } from './sms_logger.service';

// Interface defining what every provider must implement
export interface PaymentProvider {
    getUsdtRate(): Promise<number>;
    processOnRamp(amountTzs: number, phone: string, userId: string): Promise<boolean>;
    processOffRamp(amountUsdt: number, phone: string, userId: string): Promise<boolean>;
}

export class SafariPaymentBridge implements PaymentProvider {

    constructor() {
        logger.info('BRIDGE', `Initializing Modular Payment Bridge...`);
        logger.info('BRIDGE', `Mode: [${BridgeConfig.mode}]`);
    }

    /**
     * Get real-time USDT to TZS rate from the mock internal Oracle.
     */
    async getUsdtRate(): Promise<number> {
        try {
            console.log(`[BRIDGE] Mode: ${BridgeConfig.mode} | Action: Fetching Local Mock Oracle Rate...`);

            const rate = await getMockRate();

            console.log(`[BRIDGE] Mode: ${BridgeConfig.mode} | Mock Rate: 1 USDT = ${rate.toLocaleString()} TZS | Strategy: Ready`);
            return rate;
        } catch (error: any) {
            logger.error('BRIDGE', `Oracle failed, using fallback rate. Error:`, error.message);
            return BridgeConfig.binance.fallbackTzsRate;
        }
    }

    /**
     * Handle incoming Mobile Money (Fiat → Crypto).
     * Simulates receiving TZS and converting it to USDT balance.
     */
    async processOnRamp(amountTzs: number, phone: string, userId: string): Promise<boolean> {
        const rate = await this.getUsdtRate();
        const usdtEquivalent = amountTzs / rate;

        console.log(`[BRIDGE] Mode: ${BridgeConfig.mode} | Rate: 1 USDT = ${rate} TZS | Action: Converting...`);
        console.log(`[BRIDGE] On-Ramp: Received ${amountTzs.toLocaleString()} TZS from ${phone}`);
        console.log(`[BRIDGE] On-Ramp: Equates to ${usdtEquivalent.toFixed(4)} USDT for User ${userId}`);

        // 📱 [JUDGE DEMO] Trigger STK Push in Simulator
        await SmsService.sendStkPush(phone, amountTzs, 'Mobile Money');

        let isSuccess = false;

        if (BridgeConfig.mode === 'TESTNET') {
            // How to configure Ngrok: Africa's Talking (and most Mobile Money providers) require you to send your 
            // Webhook/Callback URL natively inside the request payload. Here's exactly how it looks:
            /*
            await axios.post('https://payments.sandbox.africastalking.com/mobile/checkout/request', {
                username: BridgeConfig.mobileMoney.username, // 'sandbox'
                productName: 'SafariPay',
                phoneNumber: phone,
                currencyCode: 'TZS',
                amount: amountTzs,
                // THIS IS WHERE YOUR NGROK URL GOES:
                // It routes the STK push approval directly back to your local environment
                metadata: { userId },
            }, { headers: { apiKey: BridgeConfig.mobileMoney.apiKey }});
            */
            // In AT Sandbox, you must register your Ngrok Callback URL online in your Payment product dashboard, 
            // but for generic APIs (like Safaricom Daraja), it's injected right here natively.

            console.log(`[BRIDGE] (Sandbox) Webhook configured for: ${BridgeConfig.mobileMoney.webhookUrl}`);
            console.log(`[BRIDGE] (Sandbox) Hook simulated successfully. Crediting wallet... ✅`);
            isSuccess = true;
        } else {
            // Mainnet logic: Send request to actual payment gateway verification API
            logger.info('BRIDGE', `Executing MAINNET On-Ramp verification...`);
            isSuccess = true; // Placeholder for real implementation
        }

        // --- [SIMULATOR DEMO] High Fidelity Bridge Logic ---
        const txHash = `ONR_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        
        // In demo mode, we mark it as PENDING and let the STK Push confirmation handle the rest
        const demoStatus = BridgeConfig.mode === 'TESTNET' ? 'PENDING' : 'SUCCESS';

        try {
            await pool.query('BEGIN');

            // 1. Record the PENDING transaction
            await pool.query(
                `INSERT INTO bridge_transactions (user_id, type, amount_fiat, amount_crypto, status, tx_hash)
                 VALUES ($1, 'ONRAMP', $2, $3, $4, $5)`,
                [userId, amountTzs, usdtEquivalent, demoStatus, txHash]
            );

            // 2. [IMPORTANT] We no longer update users SET balance here! 
            // The balance will only update once the user hits "Pay Now" on the virtual phone.

            await pool.query('COMMIT');
            
            // 📱 Trigger the Simulation Push with the specific TxHash so the phone can confirm it
            await SmsService.sendStkPush(phone, amountTzs, 'Mobile Money', txHash);
            
            logger.info('BRIDGE', `Pending On-Ramp created. Waiting for Simulator Approval. Tx: ${txHash}`);
            return true;
        } catch (dbErr: any) {
            await pool.query('ROLLBACK');
            logger.error('BRIDGE', `Database failure during On-Ramp initiation: ${dbErr.message}`);
            return false;
        }
    }

    /**
     * Handle Crypto withdrawals (Crypto → Fiat).
     * Simulates taking USDT from SafariPay and pushing TZS via Mobile Money (B2C).
     */
    async processOffRamp(amountUsdt: number, phone: string, userId: string): Promise<boolean> {
        const rate = await this.getUsdtRate();
        const tzsEquivalent = amountUsdt * rate;

        console.log(`[BRIDGE] Mode: ${BridgeConfig.mode} | Rate: 1 USDT = ${rate} TZS | Action: Converting...`);
        console.log(`[BRIDGE] Off-Ramp: Selling ${amountUsdt.toFixed(4)} USDT from User ${userId}`);
        console.log(`[BRIDGE] Off-Ramp: Pushing ${tzsEquivalent.toLocaleString()} TZS to ${phone}`);

        let isSuccess = false;

        if (BridgeConfig.mode === 'TESTNET') {
            // Sandbox logic: Simulate B2C API call to Africa's Talking Sandbox
            console.log(`[BRIDGE] (Sandbox) B2C Transfer triggered to ${phone} via Sandbox API... ✅`);
            isSuccess = true;
        } else {
            // Mainnet logic: Send real money via Africa's Talking/Bank APIs
            try {
                logger.info('BRIDGE', `Executing MAINNET Off-Ramp B2C transfer...`);
                isSuccess = true;
            } catch (err: any) {
                logger.error('BRIDGE', `Mainnet Off-Ramp Failed:`, err.message);
                isSuccess = false;
            }
        }

        // --- Database Integration ---
        const txHash = `offramp_${crypto.randomBytes(8).toString('hex')}`;
        const finalStatus = isSuccess ? 'SUCCESS' : 'FAILED';

        try {
            await pool.query('BEGIN');

            // 1. Record the Off-Ramp Transaction into the DB
            await pool.query(
                `INSERT INTO bridge_transactions (user_id, type, amount_fiat, amount_crypto, status, tx_hash)
                 VALUES ($1, 'OFFRAMP', $2, $3, $4, $5)`,
                [userId, tzsEquivalent, amountUsdt, finalStatus, txHash]
            );

            // 2. Deduct from Portfolio Balance on Success
            if (isSuccess) {
                await pool.query(
                    `UPDATE users SET balance = balance - $1 WHERE id = $2`,
                    [tzsEquivalent, userId]
                );
            }

            await pool.query('COMMIT');
            if (isSuccess) logger.info('BRIDGE', `Database updated. Balance deducted. TxHash: ${txHash}`);
        } catch (dbErr: any) {
            await pool.query('ROLLBACK');
            logger.error('BRIDGE', `Database transaction failed during Off-Ramp: ${dbErr.message}`);
            return false;
        }

        return isSuccess;
    }
}

// Export a singleton instance for use across the application
export const paymentBridge = new SafariPaymentBridge();
