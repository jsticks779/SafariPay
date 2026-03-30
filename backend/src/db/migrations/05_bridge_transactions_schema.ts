import pool from '../database';

async function migrate() {
    console.log('🔄 Starting Bridge Transactions Migration...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('⚙️ Creating bridge_transactions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS bridge_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                type VARCHAR(20) CHECK (type IN ('ONRAMP', 'OFFRAMP')),
                amount_fiat NUMERIC NOT NULL,
                amount_crypto NUMERIC NOT NULL,
                status VARCHAR(20) CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
                tx_hash VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Bridge Transactions System Migration Complete!');

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
