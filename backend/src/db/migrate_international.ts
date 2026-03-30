
import pool from './database';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Running Cross-Border Migrations...');

        await client.query(`
            ALTER TABLE transactions 
            ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 6),
            ADD COLUMN IF NOT EXISTS destination_currency VARCHAR(10),
            ADD COLUMN IF NOT EXISTS target_amount NUMERIC(20, 2);
        `);

        console.log('✅ transactions table updated.');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
