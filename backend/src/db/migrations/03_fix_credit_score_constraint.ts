import pool from '../database';

async function migrate() {
    console.log('🔄 Adjusting Credit Score Constraints...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Allow credit score of 0 (Trust Score start)
        console.log('⚙️ Updating `users_credit_score_check`...');
        await client.query(`
            ALTER TABLE users
            DROP CONSTRAINT IF EXISTS users_credit_score_check;
        `);

        await client.query(`
            ALTER TABLE users
            ADD CONSTRAINT users_credit_score_check 
            CHECK (credit_score >= 0 AND credit_score <= 1000);
        `);

        await client.query('COMMIT');
        console.log('✅ Constraint Updated Successfully!');

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
