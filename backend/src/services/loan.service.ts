import pool from '../db/database';
import { PoolClient } from 'pg';

export class LoanService {
    /**
     * Check if user is eligible for Level 1 (Withdrawal)
     */
    static async checkEligibility(userId: string) {
        const { rows: uRows } = await pool.query(
            'SELECT created_at, balance, last_balance_check, is_blacklisted, trust_level, is_phone_verified FROM users WHERE id=$1',
            [userId]
        );
        const user = uRows[0];
        if (!user) throw new Error('User not found');
        if (user.is_blacklisted) return { eligible: false, reason: 'Account is blacklisted due to default' };
        if (!user.is_phone_verified) return { eligible: false, reason: 'Phone number not verified' };

        // 1. Trust Level Restrictions
        let trustLimit = 0;
        if (user.trust_level === 'MEDIUM') trustLimit = 50000;
        if (user.trust_level === 'HIGH' || user.trust_level === 'Verified') trustLimit = 500000;

        // 2. Check P2P count (need >= 3)
        const { rows: tRows } = await pool.query(
            "SELECT count(*) FROM transactions WHERE sender_id=$1 AND type IN ('local', 'cross_border') AND status='completed'",
            [userId]
        );
        const p2pCount = parseInt(tRows[0].count);

        // 3. Check 48h balance hold (>= 2,000 TZS)
        const now = new Date();
        const joinedAt = new Date(user.created_at);
        const lastCheck = new Date(user.last_balance_check || user.created_at);

        const isOldEnough = (now.getTime() - joinedAt.getTime()) >= (48 * 60 * 60 * 1000);
        const hasHeldLongEnough = (now.getTime() - lastCheck.getTime()) >= (48 * 60 * 60 * 1000);
        const currentHighEnough = Number(user.balance) >= 2000;

        const requirements = [
            { name: 'elig_identity', status: ['MEDIUM', 'HIGH', 'Verified'].includes(user.trust_level), current: user.trust_level, target: 'MEDIUM' },
            { name: 'elig_p2p', status: p2pCount >= 3, current: p2pCount, target: 3 },
            { name: 'elig_balance', status: hasHeldLongEnough && currentHighEnough, current: hasHeldLongEnough ? 48 : 0, target: 48 }
        ];

        const eligible = requirements.every(r => r.status);

        return {
            eligible,
            trust_level: user.trust_level,
            trustLimit,
            requirements,
            starterLimit: 0 // Explicitly disabled as per request
        };
    }

    /**
     * Automatically deduct debt from incoming funds if user has overdue loans
     */
    static async processAutoDeduction(userId: string, incomingAmount: number, client: PoolClient) {
        const { rows: overdueLoans } = await client.query(
            "SELECT * FROM loans WHERE user_id=$1 AND status='active' AND due_date < NOW() FOR UPDATE",
            [userId]
        );

        if (overdueLoans.length === 0) return incomingAmount;

        let remainingIncoming = incomingAmount;

        for (const loan of overdueLoans) {
            if (remainingIncoming <= 0) break;

            const totalDue = Number(loan.amount) * (1 + Number(loan.interest_rate) / 100);
            const remainingDue = totalDue - Number(loan.paid_amount);
            const deduction = Math.min(remainingIncoming, remainingDue);

            if (deduction > 0) {
                const newPaid = Number(loan.paid_amount) + deduction;
                const isRepaid = newPaid >= totalDue;

                await client.query(
                    'UPDATE loans SET paid_amount=$1, status=$2, updated_at=NOW() WHERE id=$3',
                    [newPaid, isRepaid ? 'repaid' : 'active', loan.id]
                );

                await client.query(
                    'INSERT INTO loan_repayments(loan_id, user_id, amount) VALUES($1, $2, $3)',
                    [loan.id, userId, deduction]
                );

                await client.query(
                    `INSERT INTO transactions(sender_id, receiver_id, amount, type, status, description)
           VALUES($1, $1, $2, 'local', 'completed', $3)`,
                    [userId, deduction, `Auto-Debt Recovery: Repayment for loan ${loan.id.slice(0, 8)}`]
                );

                remainingIncoming -= deduction;
            }
        }

        return remainingIncoming;
    }

    /**
     * Check if the platform has enough liquidity to lend
     */
    static async checkLiquidity(requestAmount: number) {
        const { rows: liquidityRows } = await pool.query('SELECT SUM(balance) as total FROM users');
        const { rows: lentRows } = await pool.query("SELECT SUM(amount - paid_amount) as lent FROM loans WHERE status='active'");

        const totalLiquidity = Number(liquidityRows[0].total || 0);
        const totalLent = Number(lentRows[0].lent || 0);

        const reserveRatio = 0.20; // 20%
        const lendingCap = totalLiquidity * reserveRatio;

        return {
            canLend: (totalLent + requestAmount) <= lendingCap,
            currentLent: totalLent,
            cap: lendingCap
        };
    }
}
