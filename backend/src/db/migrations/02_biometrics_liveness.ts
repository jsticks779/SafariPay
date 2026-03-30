import pool from '../database';

async function migrate() {
    console.log('🔄 Starting Biometric & Liveness Schema Migration...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create `biometric_credentials` table (WebAuthn / Passkeys)
        console.log('⚙️ Creating \`biometric_credentials\` table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS biometric_credentials (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                credential_id TEXT NOT NULL UNIQUE,
                public_key TEXT NOT NULL,
                counter BIGINT DEFAULT 0,
                device_name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, credential_id)
            );
        `);

        // 2. Add `liveness_score` and `face_match_confidence` to `identity` table
        console.log('⚙️ Enhancing \`identity\` table for Selfie Verification...');
        await client.query(`
            ALTER TABLE identity
            ADD COLUMN IF NOT EXISTS liveness_score FLOAT DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS face_match_confidence FLOAT DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS kyc_provider_job_id VARCHAR(255);
        `);

        await client.query('COMMIT');
        console.log('✅ Biometric & Liveness Migration Completed!');

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
