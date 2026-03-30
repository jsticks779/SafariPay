import pool from '../db/database';
import { WalletService } from '../services/wallet.service';

async function seedWallets() {
    try {
        const { rows } = await pool.query('SELECT id FROM users WHERE wallet_address IS NULL');
        console.log(`Found ${rows.length} users without wallets. Generating...`);

        for (const user of rows) {
            // Use a default PIN '0000' for seeded wallets since they didn't provide one
            const { address, encryptedPrivateKey } = WalletService.generateWallet('0000');
            await pool.query(
                'UPDATE users SET wallet_address = $1, encrypted_private_key = $2 WHERE id = $3',
                [address, encryptedPrivateKey, user.id]
            );
            console.log(`Generated wallet for user ${user.id}: ${address}`);
        }
        console.log('Wallet seeding completed.');
    } catch (e) {
        console.error('Error seeding wallets:', e);
    } finally {
        process.exit(0);
    }
}

seedWallets();
