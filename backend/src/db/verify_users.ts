
import pool from './database';

async function verifyAll() {
    const client = await pool.connect();
    try {
        console.log('🛡️  Applying Global KYC Verifications for Testing...');

        await client.query(`
            UPDATE users 
            SET kyc_status = 'verified', nida_number = 'NIDA-TEST-2024'
            WHERE nida_number IS NULL OR kyc_status != 'verified';
        `);

        console.log('✅ All users are now Level 2 verified and ready for International Transfers.');
    } catch (e) {
        console.error('❌ Update failed:', e);
    } finally {
        client.release();
        process.exit();
    }
}

verifyAll();
