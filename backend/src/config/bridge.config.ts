import dotenv from 'dotenv';
dotenv.config();

/**
 * SafariPay — Payment Bridge Configuration
 * ========================================
 * Stores API keys and settings for On-Ramp and Off-Ramp providers.
 * Switches automatically between sandbox (testnet) and production (mainnet) 
 * based on the NODE_ENV variable.
 */

const isProduction = process.env.NODE_ENV === 'production';

export const BridgeConfig = {
    mode: isProduction ? 'MAINNET' : 'TESTNET',

    // Binance API (Oracles & Pricing)
    binance: {
        baseUrl: 'https://api.binance.com/api/v3',
        fallbackTzsRate: 2650, // Fallback if TZS pair isn't natively supported
    },

    // Mobile Money Provider (e.g., Africa's Talking / Custom Gateway)
    mobileMoney: {
        apiKey: process.env.MM_API_KEY || (isProduction ? '' : 'sandbox_api_key_placeholder'),
        username: process.env.MM_USERNAME || (isProduction ? '' : 'sandbox'),
        webhookSecret: process.env.MM_WEBHOOK_SECRET || 'sandbox_secret_placeholder',

        // Your Ngrok URL for receiving AT Webhooks locally
        webhookUrl: process.env.NGROK_URL || 'https://my-ngrok.ngrok-free.app/api/v1/bridge/sandbox/webhook/onramp',

        endpoints: {
            b2c: isProduction
                ? 'https://payments.africastalking.com/mobile/b2c/request'  // Mainnet 
                : 'https://payments.sandbox.africastalking.com/mobile/b2c/request', // Testnet
        }
    }
};

/**
 * Local Testnet Price Oracle
 * Randomly generates a fluctuating TZS/USDT rate between 2,800 and 2,900 
 * to securely simulate the market volatility for the user's localized setup.
 */
export async function getMockRate(): Promise<number> {
    const min = 2800;
    const max = 2900;
    // Generate a random float between 2800.00 and 2900.99
    const fluctuation = Math.random() * (max - min) + min;
    return Math.round(fluctuation * 100) / 100;
}
