import pool from '../db/database';

export class RiskManagement {
    /**
     * Run automated risk assessments and penalties
     */
    static async runDailyAssessments() {
        console.log('🛡️ [RISK] Running daily lending risk assessments...');

        // 1. Credit Score Decay: If loan is overdue by > 7 days, drop score by 50%
        const { rowCount: decayCount } = await pool.query(`
      UPDATE users 
      SET credit_score = credit_score * 0.5 
      WHERE id IN (
        SELECT user_id FROM loans 
        WHERE status = 'active' 
        AND due_date < NOW() - INTERVAL '7 days'
      )
    `);
        if (decayCount > 0) console.log(`📉 [RISK] Applied 50% credit score decay to ${decayCount} overdue accounts.`);

        // 2. Blacklisting: If loan is defaulted (> 30 days), blacklist user
        const { rowCount: blacklistCount } = await pool.query(`
      UPDATE users 
      SET is_blacklisted = true, updated_at = NOW()
      WHERE id IN (
        SELECT user_id FROM loans 
        WHERE status = 'active' 
        AND due_date < NOW() - INTERVAL '30 days'
      )
    `);

        if (blacklistCount > 0) {
            console.log(`🚫 [RISK] Blacklisted ${blacklistCount} accounts due to 30-day default.`);

            // Also mark those loans as defaulted in the DB
            await pool.query(`
        UPDATE loans 
        SET status = 'defaulted', updated_at = NOW()
        WHERE status = 'active' 
        AND due_date < NOW() - INTERVAL '30 days'
      `);
        }

        return { decayCount, blacklistCount };
    }
}
