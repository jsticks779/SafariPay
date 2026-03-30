import axios from 'axios';

export class OracleService {
    /**
     * Fetches real-time FX rates. For cross-border logic.
     * Simulated or real-time using a public API.
     */
    static async getFXRate(from: string, to: string): Promise<number> {
        // Real-world: Use Chainlink Price Feeds or similar.
        // Simulation: Fetch from a mock service or use hardcoded base rates with jitter.

        const baseRates: Record<string, number> = {
            'TZS_USD': 0.00039,
            'USD_TZS': 2580,
            'TZS_KES': 0.057,
            'KES_TZS': 17.5,
            'TZS_GBP': 0.00031,
            'GBP_TZS': 3250
        };

        const key = `${from}_${to}`;
        const rate = baseRates[key] || 1;

        // Add a tiny bit of random jitter (0.01%)
        const jitter = 1 + (Math.random() * 0.0002 - 0.0001);

        return rate * jitter;
    }

    /**
     * Converts TZS amount to Stablecoin (USD pegged).
     */
    static async tzsToStable(amount: number): Promise<number> {
        const rate = await this.getFXRate('TZS', 'USD');
        return amount * rate;
    }
}
