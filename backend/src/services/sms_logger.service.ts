import { BriqSmsController } from '../controllers/smsController';

interface MessageLog {
    id: string;
    to: string;
    message: string;
    type: 'OTP' | 'TRANSACTION' | 'SYSTEM' | 'SECURITY' | 'STK_PUSH';
    channel: 'SMS' | 'EMAIL' | 'PUSH';
    timestamp: Date;
    previewUrl?: string;
    amount?: number;
    provider?: string;
}

class SmsLoggerService {
    private maxLogs = 100;
    private pool = require('../db/database').default;

    constructor() {
        console.log('✅ [MESSAGING] Permanent DB Messaging Store Initialized');
    }

    async sendSms(to: string, message: string, type: MessageLog['type'] = 'SYSTEM', sender: string = 'SAFARIPAY') {
        try {
            await this.pool.query(
                `INSERT INTO system_messages (recipient_phone, message, msg_type, channel, sender) VALUES ($1, $2, $3, 'SMS', $4)`,
                [to, message, type, sender.toUpperCase()]
            );
            
            // Forward to console simulator
            await BriqSmsController.sendSms(to, message);
            return true;
        } catch (e) {
            console.error('Failed to log SMS to DB:', e);
            return false;
        }
    }

    async sendEmail(to: string, message: string, type: MessageLog['type'] = 'SYSTEM', sender: string = 'SAFARIPAY Support') {
        try {
            await this.pool.query(
                `INSERT INTO system_messages (recipient_phone, message, msg_type, channel, sender) VALUES ($1, $2, $3, 'EMAIL', $4)`,
                [to, message, type, sender]
            );
            console.log(`\n\x1b[34m[EMAIL SENT]\x1b[0m 📧 From: ${sender} | To: ${to} | 📜 Msg: ${message}\n`);
            return true;
        } catch (e) {
            console.error('Failed to log Email to DB:', e);
            return false;
        }
    }

    async sendStkPush(to: string, amount: number, provider: string, txHash?: string) {
        try {
            const sender = provider.includes('M-Pesa') ? 'Vodacom' : provider.includes('Tigo') ? 'TigoPesa' : 'PUSH_GW';
            const msg = `Do you want to pay ${amount.toLocaleString()} TZS to SafariPay? Enter ${provider} PIN:`;
            await this.pool.query(
                `INSERT INTO system_messages (recipient_phone, message, msg_type, channel, amount, provider, sender) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [to, msg, 'STK_PUSH', 'PUSH', amount, txHash || provider, sender]
            );
            console.log(`\n\x1b[35m[STK PUSH SENT]\x1b[0m 📲 From: ${sender} | To: ${to} | Amount: ${amount} | Tx: ${txHash || provider}\n`);
            return true;
        } catch (e) {
            console.error('Failed to log STK Push to DB:', e);
            return false;
        }
    }

    async sendOtp(to: string, code: string) {
        const msg = `Your SafariPay verification code is: ${code}. Do not share this code with anyone.`;
        await this.sendSms(to, msg, 'OTP', 'SAFARIPAY');
        await this.sendEmail(to, msg, 'OTP', 'SafariPay Security');
        return true;
    }

    async getLogsByPhone(phone: string) {
        try {
            // Clean phone number for consistency
            const cleanPhone = phone.replace(/\D/g, '');
            const { rows } = await this.pool.query(
                `SELECT id, recipient_phone as to, sender, message, msg_type as type, channel, amount, provider, created_at as timestamp 
                 FROM system_messages 
                 WHERE recipient_phone LIKE $1 
                 ORDER BY created_at DESC LIMIT $2`,
                [`%${cleanPhone}%`, this.maxLogs]
            );
            return rows;
        } catch (e) {
            console.error('Failed to fetch logs from DB:', e);
            return [];
        }
    }

    async clearLogs() {
        await this.pool.query(`DELETE FROM system_messages`);
    }
}

export const SmsService = new SmsLoggerService();
