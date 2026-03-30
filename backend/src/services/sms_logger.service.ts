import { BriqSmsController } from '../controllers/smsController';

interface MessageLog {
    id: string;
    to: string;
    message: string;
    type: 'OTP' | 'TRANSACTION' | 'SYSTEM' | 'SECURITY';
    channel: 'SMS' | 'EMAIL';
    timestamp: Date;
    previewUrl?: string;
}

class SmsLoggerService {
    private logs: MessageLog[] = [];
    private maxLogs = 100;

    constructor() {
        console.log('✅ [MESSAGING] Local Testnet Messaging Initialized (No External APIs)');
    }

    async sendSms(to: string, message: string, type: MessageLog['type'] = 'SYSTEM') {
        const log: MessageLog = {
            id: Math.random().toString(36).substring(7),
            to,
            message,
            type,
            channel: 'SMS',
            timestamp: new Date()
        };

        // Forward to our console simulator
        await BriqSmsController.sendSms(to, message);

        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        return true;
    }

    async sendEmail(to: string, message: string, type: MessageLog['type'] = 'SYSTEM') {
        const log: MessageLog = {
            id: Math.random().toString(36).substring(7),
            to,
            message,
            type,
            channel: 'EMAIL',
            timestamp: new Date()
        };

        console.log(`\n\x1b[34m[EMAIL SENT]\x1b[0m 📧 To: ${to}`);
        console.log(`\x1b[34m[EMAIL SENT]\x1b[0m ✉️ Subject: SafariPay Security - ${type}`);
        console.log(`\x1b[34m[EMAIL SENT]\x1b[0m 📜 Body: ${message}\n`);

        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        return true;
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }
}

export const SmsService = new SmsLoggerService();
