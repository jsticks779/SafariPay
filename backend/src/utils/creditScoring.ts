import pool from '../db/database';

/**
 * SafariPay ML Engine: Heuristic for Behavioral Credit Scoring
 * Predicts safe microloan limits and adjusts credit lines dynamically.
 * Deploying statistical weightings evaluated against real-time transaction volume.
 */
export class CreditScoringEngine {
    static async evaluateTransactionBehavior(userId: string) {
        const client = await pool.connect();
        try {
            // 1. Fetch user's core attributes
            const userQuery = await client.query('SELECT credit_score FROM users WHERE id=$1', [userId]);
            if (!userQuery.rows.length) return;
            let currentScore = userQuery.rows[0].credit_score;

            // 2. Aggregate Multi-Dimensional Metrics (Last 30 days)
            const metrics = await client.query(`
                SELECT 
                    COUNT(CASE WHEN type = 'local' AND sender_id = $1 THEN 1 END) as send_count,
                    COALESCE(SUM(CASE WHEN type = 'top_up' AND receiver_id = $1 THEN amount END), 0) as deposit_volume,
                    COUNT(CASE WHEN type = 'loan_repayment' AND sender_id = $1 THEN 1 END) as repayment_count
                FROM transactions 
                WHERE (sender_id=$1 OR receiver_id=$1) AND created_at >= NOW() - INTERVAL '30 days'
            `, [userId]);

            const { send_count, deposit_volume, repayment_count } = metrics.rows[0];
            const txCount = Number(send_count);
            const totalDeposits = Number(deposit_volume);
            const totalRepayments = Number(repayment_count);

            // --- 'True' Behavioral Credit Scoring Weights ---
            let delta = 0;

            // Rule 1: Usage Frequency (+Points for active ecosystem participation)
            if (txCount > 5) delta += 5;
            if (txCount > 15) delta += 10;

            // Rule 2: Deposit Reliability (+Points for keeping liquidity on-platform)
            if (totalDeposits > 50000) delta += 10;
            if (totalDeposits > 500000) delta += 20;

            // Rule 3: Repayment Discipline (CRITICAL: Most weighted signal)
            if (totalRepayments > 0) delta += 15; // Reward taking and finishing one loan
            if (totalRepayments > 3) delta += 30; // High confidence in recurring borrower

            // Cap and Apply Score Updates
            if (delta > 0 && currentScore < 850) {
                let newScore = Math.min(850, currentScore + delta);

                await client.query('BEGIN');
                await client.query('UPDATE users SET credit_score=$1 WHERE id=$2', [newScore, userId]);

                // Log the credit signal for the internal audit trail
                await client.query(`
                    INSERT INTO credit_signals (user_id, signal_type, value, description)
                    VALUES ($1, $2, $3, $4)
                `, [userId, 'safari_ml_v2', delta, `Score refreshed: ${txCount} txs, ${totalDeposits} deposit vol, ${totalRepayments} repayments.`]);

                await client.query('COMMIT');
                console.log(`🧠 [SafariPay ML v2] Re-scored User ${userId}: +${delta} points. New Score: ${newScore}`);
            }
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('SafariPay ML Engine Error:', e);
        } finally {
            client.release();
        }
    }
}
