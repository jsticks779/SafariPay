import axios from 'axios';
import pool from '../db/database';
import { logger } from '../utils/logger';

/**
 * SafariPay — Multi-Currency Localization Engine
 * ===============================================
 * Integrates ExchangeRate-API for real-time global rates.
 * Implements 1-hour database caching to maintain decentralisation 
 * and speed while providing a "Bank-like" local experience.
 */
export class FXService {
    private static API_KEY = process.env.EXCHANGERATE_API_KEY;
    private static BASE_URL = `https://v6.exchangerate-api.com/v6/${this.API_KEY}/latest/USD`;

    // High-performance local fallback rates
    private static readonly MOCK_RATES: Record<string, number> = {
        'TZS': 2540.00,
        'KES': 130.50,
        'UGX': 3720.00
    };

    /**
     * Resolves USDT to Local Currency based on user country.
     * @param amountUSDT — Amount in USDT
     * @param countryCode — 'TZ', 'KE', 'NG', etc.
     */
    static async convertToLocalCurrency(amountUSDT: number, countryCode: string = 'TZ'): Promise<{
        amount: number;
        currency: string;
        rate: number;
    }> {
        const currencyMap: Record<string, string> = {
            'TZ': 'TZS', 'KE': 'KES', 'UG': 'UGX'
        };
        const targetCurrency = currencyMap[countryCode] || 'TZS';

        const rate = await this.getLiveRate(targetCurrency);
        return {
            amount: Number((amountUSDT * rate).toFixed(2)),
            currency: targetCurrency,
            rate
        };
    }
    
    /**
     * Converts from one local currency to another using USD as the base.
     * @param amount — Amount in the source currency
     * @param from — Source currency code (e.g., 'TZS')
     * @param to — Target currency code (e.g., 'KES')
     */
    static async convert(amount: number, from: string, to: string): Promise<{ targetAmount: number, rate: number }> {
        const fromRate = await this.getLiveRate(from);
        const toRate = await this.getLiveRate(to);

        // Convert from -> USD -> to
        const usdAmount = amount / fromRate;
        const targetAmount = Number((usdAmount * toRate).toFixed(2));
        const effectiveRate = toRate / fromRate;

        return { targetAmount, rate: effectiveRate };
    }

    /**
     * Fetches the real-time rate with 1-hour DB caching.
     */
    static async getLiveRate(target: string): Promise<number> {
        try {
            // 1. Check Database Cache (1-hour TTL)
            const { rows } = await pool.query(
                `SELECT rate FROM exchange_rates 
                 WHERE target_currency = $1 AND last_updated > NOW() - INTERVAL '1 hour'`,
                [target]
            );

            if (rows.length > 0) return parseFloat(rows[0].rate);

            // 2. Fetch from External API if cache expired or missing
            logger.info('BRIDGE', `Cache miss for ${target}. Fetching live forex rates...`);

            let rate = this.MOCK_RATES[target] || 1.0;

            if (this.API_KEY && this.API_KEY !== 'your_api_key_here') {
                const res = await axios.get(this.BASE_URL);
                if (res.data?.conversion_rates?.[target]) {
                    rate = res.data.conversion_rates[target];
                }
            }

            // 3. Update Cache
            await pool.query(
                `INSERT INTO exchange_rates (target_currency, rate, last_updated)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (base_currency, target_currency) 
                 DO UPDATE SET rate = EXCLUDED.rate, last_updated = NOW()`,
                [target, rate]
            );

            return rate;
        } catch (err: any) {
            logger.warn('BRIDGE', `Forex API failed, falling back to mock: ${err.message}`);
            return this.MOCK_RATES[target] || 1.0;
        }
    }

    /**
     * Formats a local currency string (e.g., 42,750 TZS).
     */
    static formatLocal(amount: number, currency: string): string {
        return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
    }

    /**
     * Returns a fixed, beautiful starter limit for the given currency.
     * Standardizes the initial credit limit across the platform.
     */
    static getStarterLimit(currency: string): number {
        const limits: Record<string, number> = {
            'TZS': 5000,
            'KES': 260,
            'UGX': 7500
        };
        return limits[currency] || 5000;
    }
}
