import { v4 as uuidv4 } from 'uuid';

export type MobileProvider = 'MPESA' | 'TIGOPESA' | 'AIRTELMONEY' | 'HALOPESA' | 'STRIPE' | 'FLUTTERWAVE';

export interface GatewayResponse {
    success: boolean;
    reference: string;
    message: string;
    provider: MobileProvider;
}

/**
 * Universal Gateway Service
 * -------------------------
 * Bridges SafariPay to any mobile money provider in Tanzania and global cards.
 */
export class UniversalGatewayService {
    /**
     * Handles deposits from any supported provider.
     */
    static async handleDeposit(provider: MobileProvider, phone: string, amount: number): Promise<GatewayResponse> {
        console.log(`🔌 [UNIVERSAL] Routing ${amount} TZS deposit via ${provider} for ${phone}`);

        // Mocking the specific logic for each provider
        const isSuccess = Math.random() > 0.05;

        switch (provider) {
            case 'MPESA':
                return { success: isSuccess, reference: `MP-${uuidv4().substring(0, 8)}`, message: 'STK Push Sent', provider };
            case 'TIGOPESA':
                return { success: isSuccess, reference: `TG-${uuidv4().substring(0, 8)}`, message: 'Tigo Pesa Request Sent', provider };
            case 'AIRTELMONEY':
                return { success: isSuccess, reference: `AM-${uuidv4().substring(0, 8)}`, message: 'Airtel Money Push Sent', provider };
            case 'HALOPESA':
                return { success: isSuccess, reference: `HP-${uuidv4().substring(0, 8)}`, message: 'HaloPesa Request Sent', provider };
            case 'STRIPE':
            case 'FLUTTERWAVE':
                return { success: isSuccess, reference: `GB-${uuidv4().substring(0, 8)}`, message: 'Global Card Session Created', provider };
            default:
                throw new Error('Unsupported provider');
        }
    }

    /**
     * Handles payouts/withdrawals to any supported provider (Off-Ramping logic).
     */
    static async handleWithdraw(provider: MobileProvider, identifier: string, amountTzs: number, userId: string, userPin: string): Promise<GatewayResponse> {
        const bcrypt = require('bcryptjs');
        const { decryptPrivateKey } = require('../utils/cryptoUtils');
        const { UnifiedTransferService } = require('./transfer.service');
        const { SmsService } = require('./sms_logger.service');
        const pool = require('../db/database').default;
        
        console.log(`🔌 [UNIVERSAL] Routing ${amountTzs} TZS withdrawal to ${identifier} via ${provider}`);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows: uR } = await client.query('SELECT phone, name, balance, pin_hash, encrypted_private_key, country FROM users WHERE id=$1 FOR UPDATE', [userId]);
            if (!uR.length) throw new Error('User not found');
            const user = uR[0];

            // 1. PIN Security
            const isPinValid = await bcrypt.compare(userPin, user.pin_hash);
            if (!isPinValid) throw new Error('Invalid security PIN');

            try {
                decryptPrivateKey(user.encrypted_private_key, userPin);
            } catch (e) {
                throw new Error('Security alert: Signing key recovery failed.');
            }

            // 2. Dynamic Country Detection & Real-Time Exchange Rate Math 🌍
            const { FXService } = require('./fx.service');
            let targetCurrency = 'TZS'; // Default fallback
            
            // Detect recipient's country code from identifier (phone number)
            if (identifier.startsWith('+254')) {
                targetCurrency = 'KES';
                console.log(`🌍 [UNIVERSAL] Detected Kenya (+254), wrapping to KES.`);
            } else if (identifier.startsWith('+256')) {
                targetCurrency = 'UGX';
                console.log(`🌍 [UNIVERSAL] Detected Uganda (+256), wrapping to UGX.`);
            } else if (identifier.startsWith('+255')) {
                targetCurrency = 'TZS';
                console.log(`🌍 [UNIVERSAL] Detected Tanzania (+255), wrapping to TZS.`);
            } else {
                console.log(`🌍 [UNIVERSAL] Unknown prefix for ${identifier}, defaulting to TZS.`);
            }

            // Fetch Live Exchange Rate mapping USDT to Local
            const EXCHANGE_RATE = await FXService.getLiveRate(targetCurrency);
            const usdtAmount = amountTzs / EXCHANGE_RATE;

            if (user.balance < amountTzs) {
                throw new Error('Insufficient internal TZS balance.');
            }

            // 3. Deduct from the internal balance (Tier 3)
            const fee = Math.round(amountTzs * 0.01);
            const totalDeduct = amountTzs + fee;
            if (user.balance < totalDeduct) throw new Error('Insufficient balance to cover withdrawal fee (1%)');

            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalDeduct, userId]);

            // Tier 1 execution (Polygon) - Auto-Liquidity unwrapping
            const unifiedRes = await UnifiedTransferService.execute({
                userId,
                category: 'withdraw',
                amount: usdtAmount,
                recipient: '0x000000000000000000000000000000000000dEaD', // Burn/Treasury return
                description: `Off-ramp to ${provider} ${targetCurrency}`
            });

            // 4. Record Successful Transaction
            const txHash = unifiedRes.txHash || `WID-${uuidv4().substring(0, 8)}`;
            await client.query(
                `INSERT INTO transactions(sender_id, receiver_phone, amount, type, status, description, fee, tx_hash)
                 VALUES ($1, $2, $3, 'local', 'SUCCESS', $4, $5, $6)`,
                [userId, identifier, amountTzs, `Cash out via ${provider} (${usdtAmount.toFixed(2)} USDT -> ${targetCurrency})`, fee, txHash]
            );

            await client.query('COMMIT');

            // 5. Mock API Call & SMS Notification
            await SmsService.sendSms(
                user.phone,
                `WITHDRAWAL SUCCESS: ${amountTzs.toLocaleString()} TZS sent to ${provider} (${identifier}). Fee: ${fee} TZS. Conversion: ${usdtAmount.toFixed(2)} USDT.`,
                'TRANSACTION'
            );

            return {
                success: true,
                reference: txHash,
                message: `Withdrawal of ${amountTzs} TZS processed successfully.`,
                provider
            };
        } catch (e: any) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
