import pool from '../database';

async function migrate() {
    console.log('🔄 Starting KYC Schema Migration...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Modify `users` table
        console.log('⚙️ Updating `users` table...');
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS trust_level VARCHAR(20) DEFAULT 'LOCKED';
        `);

        // If there are existing users, let's unlock them and assume they are verified for backwards compatibility
        await client.query(`
            UPDATE users SET is_phone_verified=true, trust_level='HIGH' WHERE trust_level='LOCKED';
        `);

        // 2. Create `identity` table
        console.log('⚙️ Creating `identity` table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS identity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                id_type VARCHAR(50),
                id_number TEXT,
                id_image_url TEXT,
                selfie_image_url TEXT,
                verification_status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        `);

        // 3. Create `otps` table
        console.log('⚙️ Creating `otps` table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS otps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phone VARCHAR(30) UNIQUE NOT NULL,
                code_hash TEXT NOT NULL,
                attempts INT DEFAULT 0,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Create `devices` table
        console.log('⚙️ Creating `devices` table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                device_hash TEXT NOT NULL,
                device_info JSONB,
                ip_address VARCHAR(50),
                last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, device_hash)
            );
        `);

        await client.query('COMMIT');
        console.log('✅ KYC Schema Migration Completed Successfully!');

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
