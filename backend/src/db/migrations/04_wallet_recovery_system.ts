/**
 * Migration 04: Social Recovery & Seed Phrase Backup Tables
 * ==========================================================
 * Adds:
 *   - encrypted_mnemonic column to users table
 *   - social_recovery table (guardian registry)
 *   - recovery_requests table (recovery session tracking)
 *   - key_shares table (secret splitting storage)
 */

import pool from '../database';

async function migrate() {
    console.log('🔄 Starting Wallet Recovery System Migration...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Add encrypted mnemonic column to users table
        console.log('⚙️ Adding encrypted_mnemonic to users table...');
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS encrypted_mnemonic TEXT;
        `);

        // 2. Social Recovery Guardians
        console.log('⚙️ Creating social_recovery table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS social_recovery (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                guardian_phone VARCHAR(30) NOT NULL,
                guardian_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guardian_phone)
            );
        `);

        // 3. Recovery Requests (session tracking)
        console.log('⚙️ Creating recovery_requests table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS recovery_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                required_approvals INT NOT NULL DEFAULT 2,
                received_approvals INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP WITH TIME ZONE
            );
        `);

        // 4. Key Shares (Secret Splitting storage)
        console.log('⚙️ Creating key_shares table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS key_shares (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                share_type VARCHAR(20) NOT NULL,
                share_data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, share_type)
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Wallet Recovery System Migration Complete!');

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
