/**
 * SafariPay — Structured Logger
 * ==============================
 * Production-grade logging for blockchain operations.
 * Categories: BLOCKCHAIN, TX, USDT, GAS, WALLET, SECURITY, QUEUE
 */

type LogCategory = 'BLOCKCHAIN' | 'TX' | 'USDT' | 'GAS' | 'WALLET' | 'SECURITY' | 'QUEUE' | 'API' | 'DB' | 'AUTH' | 'BRIDGE' | 'TRANSFER' | 'AUTO_CONVERT' | 'STORAGE';

const isProduction = process.env.NODE_ENV === 'production';

function timestamp(): string {
    return new Date().toISOString();
}

function formatMessage(level: string, category: LogCategory, message: string, data?: Record<string, any>): string {
    const base = `[${timestamp()}] [${level}] [${category}] ${message}`;
    if (data && !isProduction) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}

export const logger = {
    info(category: LogCategory, message: string, data?: Record<string, any>) {
        console.log(formatMessage('INFO', category, message, data));
    },

    warn(category: LogCategory, message: string, data?: Record<string, any>) {
        console.warn(formatMessage('WARN', category, message, data));
    },

    error(category: LogCategory, message: string, data?: Record<string, any>) {
        console.error(formatMessage('ERROR', category, message, data));
    },

    /** Log a blockchain transaction event */
    tx(action: 'SUBMIT' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERTED', txHash: string, details?: Record<string, any>) {
        const level = action === 'FAILED' || action === 'REVERTED' ? 'ERROR' : 'INFO';
        const msg = formatMessage(level, 'TX', `${action}: ${txHash}`, details);
        if (level === 'ERROR') console.error(msg);
        else console.log(msg);
    },

    /** Log a security-sensitive event (never log secrets!) */
    security(event: string, userId?: string, details?: Record<string, any>) {
        // Strip any sensitive fields from details
        const safe = details ? { ...details } : {};
        delete safe.privateKey;
        delete safe.pin;
        delete safe.password;
        delete safe.encryptedKey;
        console.warn(formatMessage('WARN', 'SECURITY', `${event} [user:${userId || 'unknown'}]`, safe));
    },
};
