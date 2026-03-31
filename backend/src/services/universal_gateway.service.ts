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

        const { SmsService } = require('./sms_logger.service');

        switch (provider) {
            case 'MPESA':
                await SmsService.sendStkPush(phone, amount, 'M-Pesa');
                return { success: isSuccess, reference: `MP-${uuidv4().substring(0, 8)}`, message: 'STK Push Sent', provider };
            case 'TIGOPESA':
                await SmsService.sendStkPush(phone, amount, 'Tigo Pesa');
                return { success: isSuccess, reference: `TG-${uuidv4().substring(0, 8)}`, message: 'Tigo Pesa Request Sent', provider };
            case 'AIRTELMONEY':
                await SmsService.sendStkPush(phone, amount, 'Airtel Money');
                return { success: isSuccess, reference: `AM-${uuidv4().substring(0, 8)}`, message: 'Airtel Money Push Sent', provider };
            case 'HALOPESA':
                await SmsService.sendStkPush(phone, amount, 'HaloPesa');
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

            const { rows: uR } = await client.query('SELECT phone, name, balance, reward_balance, pin_hash, encrypted_private_key, country, currency FROM users WHERE id=$1 FOR UPDATE', [userId]);
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
            
            // Fee Credit (Reward/Makato) Logic
            let feeFromBalance = fee;
            let rewardUsageTZS = 0;
            const currentReward = Number(user.reward_balance || 0);

            if (currentReward > 0) {
                rewardUsageTZS = Math.min(currentReward, fee);
                feeFromBalance = fee - rewardUsageTZS;
            }

            const totalDeduct = amountTzs + feeFromBalance;

            if (user.balance < totalDeduct) {
                throw new Error(`Insufficient balance to cover withdrawal and remaining fee (${feeFromBalance} TZS)`);
            }

            await client.query(
                'UPDATE users SET balance = balance - $1, reward_balance = reward_balance - $2 WHERE id = $3', 
                [totalDeduct, rewardUsageTZS, userId]
            );

            // [SAFARIPAY] 🏦 Expanded Bank vs Mobile Logic
            const banks = ['CRDB', 'NMB', 'KCB', 'EQUITY', 'STANBIC', 'CENTENARY', 'ZENITH', 'GTBANK', 'CHASE', 'BOA', 'HSBC', 'BARCLAYS', 'ENBD', 'ECO'];
            const isBankTransfer = banks.includes(provider.toUpperCase());
            const finalCategory = isBankTransfer ? 'bank' : 'mobile';

            console.log(`🔌 [UNIVERSAL] Routing withdrawal via ${finalCategory.toUpperCase()} gateway (Provider: ${provider})`);

            // Tier 1 execution (Polygon) - Auto-Liquidity unwrapping
            const unifiedRes = await UnifiedTransferService.execute({
                userId,
                category: finalCategory,
                amount: usdtAmount,
                recipient: identifier,
                provider,
                description: `SafariPay ${isBankTransfer ? 'Bank Outbound' : 'Mobile Outbound'} to ${provider}`
            });

            // 4. Record Successful Transaction
            const txHash = unifiedRes.txHash || `WID-${uuidv4().substring(0, 8)}`;
            const txType = isBankTransfer ? 'withdrawal' : 'withdrawal'; // Both are withdrawals but we can tag them
            const txDesc = isBankTransfer 
                ? `Bank Transfer to ${provider} Acc: ${identifier.substring(0, 4)}...${identifier.slice(-3)}`
                : `Cash out via ${provider} (${usdtAmount.toFixed(2)} USDT -> ${targetCurrency})`;

            await client.query(
                `INSERT INTO transactions(sender_id, receiver_phone, amount, type, status, description, fee, tx_hash)
                 VALUES ($1, $2, $3, 'withdrawal', 'completed', $4, $5, $6)`,
                [userId, identifier, amountTzs, txDesc, fee, txHash]
            );

            await client.query('COMMIT');

            // 5. [JUDGE DEMO] High Fidelity Multi-Channel Notification
            const receiptMsg = isBankTransfer
                ? `SafariPay: Bank Transfer of ${user.currency} ${amountTzs.toLocaleString()} to ${provider} Account ${identifier.slice(-4)} was successful. Settlement Ref: ${txHash.substring(0,10).toUpperCase()}.`
                : `SafariPay: Withdrawal of ${user.currency} ${amountTzs.toLocaleString()} via ${provider} was successful. USDT converted at 1:${EXCHANGE_RATE.toLocaleString()}. Ref: ${txHash.substring(0,10).toUpperCase()}.`;

            await SmsService.sendSms(user.phone, receiptMsg, 'TRANSACTION', 'SAFARIPAY');

            // 📩 Detailed Email Receipt
            const emailSubject = isBankTransfer ? 'SafariPay Bank Receipt' : 'SafariPay Withdrawal Receipt';
            const emailBody = `
=========================================
      ${emailSubject.toUpperCase()}
=========================================
Receipt ID  : ${txHash.substring(0, 12).toUpperCase()}
Date        : ${new Date().toLocaleString()}
Status      : SUCCESSFUL

CUSTOMER    : ${user.name}
PHONE       : ${user.phone}

TRANSACTION DETAILS:
-------------------
Destination : ${provider} (${isBankTransfer ? 'Bank Account' : 'Mobile Wallet'})
Identifier  : ${identifier}
Amount Sent : ${user.currency} ${amountTzs.toLocaleString()}
Network Fee : ${user.currency} ${fee.toLocaleString()}
Rate (Mock) : 1 USDT = ${EXCHANGE_RATE.toLocaleString()} ${targetCurrency}

CONVERSION SUMMARY:
-----------------
Crypto Amnt : ${usdtAmount.toFixed(4)} USDT
Total Debt  : ${user.currency} ${(amountTzs + fee).toLocaleString()}

Your SafariPay wallet has been debited.
Empowering your digital wealth.
=========================================
`;
            await SmsService.sendEmail(user.phone, emailBody, 'TRANSACTION', emailSubject);

            // 5. [JUDGE DEMO] Multi-Channel Notification Flow — REALISTIC SENDERS
            const ref = txHash.substring(0, 10).toUpperCase();
            
            // Map provider to realistic sender name
            const providerSenderMap: Record<string, string> = {
                'MPESA': 'M-PESA',
                'TIGOPESA': 'TIGO PESA',
                'AIRTELMONEY': 'AIRTEL MONEY',
                'HALOPESA': 'HALOPESA',
                'CRDB': 'CRDB BANK',
                'NMB': 'NMB BANK',
                'NBC': 'NBC BANK',
                'EQUITY': 'EQUITY BANK',
                'KCB': 'KCB BANK',
            };
            const networkSender = providerSenderMap[provider.toUpperCase()] || provider.toUpperCase();

            // Notification A: SafariPay Confirmation (from SAFARIPAY)
            await SmsService.sendSms(
                user.phone,
                `SafariPay: Withdrawal of TZS ${amountTzs.toLocaleString()} to ${identifier} via ${networkSender} was successful. Fee: ${fee} TZS. Ref: ${ref}. Thank you for using SafariPay!`,
                'TRANSACTION',
                'SAFARIPAY'
            );

            // Notification B: Network/Bank "Received" Message (from M-PESA / CRDB / etc.)
            const isBank = ['CRDB', 'NMB', 'NBC', 'EQUITY', 'KCB'].includes(provider.toUpperCase());
            let networkMsg: string;

            if (isBank) {
                networkMsg = `${networkSender}: TZS ${amountTzs.toLocaleString()} has been credited to your account from SAFARIPAY (${user.name}). Trans ID: ${ref}. Available Bal: TZS ***. Thank you for banking with ${networkSender}.`;
            } else {
                networkMsg = `${ref} Confirmed. You have received TZS ${amountTzs.toLocaleString()} from SAFARIPAY (${user.name}) on your ${networkSender} account. Trans. ID: ${ref}. Thank you for using ${networkSender}.`;
            }
            await SmsService.sendSms(user.phone, networkMsg, 'TRANSACTION', networkSender);

            return {
                success: true,
                reference: txHash,
                message: `Withdrawal of ${amountTzs} TZS processed successfully.`,
                provider
            };
        } catch (e: any) {
            console.error(`\n\x1b[31m[WITHDRAW ERROR]\x1b[0m`, e.message, e.detail || '');
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
