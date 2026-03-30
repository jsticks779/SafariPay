import { BriqSmsController } from '../controllers/smsController';

interface MessageLog {
    id: string;
    to: string; // Phone or Email
    message: string;
    type: 'OTP' | 'TRANSACTION' | 'SYSTEM' | 'SECURITY';
    channel: 'SMS' | 'EMAIL';
    timestamp: Date;
}

class MessagingLoggerService {
    private logs: MessageLog[] = [];
    private maxLogs = 200;

    async send(to: string, message: string, channel: MessageLog['channel'], type: MessageLog['type'] = 'SYSTEM') {
        const log: MessageLog = {
            id: Math.random().toString(36).substring(7),
            to,
            message,
            type,
            channel,
            timestamp: new Date()
        };

        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        const icon = channel === 'SMS' ? '📡' : '📧';
        console.log(`${icon} [${channel} SIMULATOR] To: ${to} | Message: ${message}`);
        return true;
    }

    async sendSms(to: string, message: string, type: MessageLog['type'] = 'SYSTEM') {
        // If we have a Briq key, send a real SMS for all types
        console.log(`🔎 [MESSAGING] sendSms triggered for ${to}. BRIQ_APP_KEY present: ${!!process.env.BRIQ_APP_KEY}`);

        if (process.env.BRIQ_APP_KEY) {
            await BriqSmsController.sendSms(to, message);
        }
        return this.send(to, message, 'SMS', type);
    }

    async sendEmail(to: string, message: string, type: MessageLog['type'] = 'SYSTEM') {
        return this.send(to, message, 'EMAIL', type);
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }
}

export const MessagingService = new MessagingLoggerService();
