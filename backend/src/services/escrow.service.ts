import pool from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export enum EscrowStatus {
    HELD = 'held',
    RELEASED = 'released',
    DISPUTED = 'disputed',
    REFUNDED = 'refunded'
}

/**
 * Escrow Service
 * --------------
 * Manages the P2P transaction lifecycle where funds are held in a secure state
 * until both parties (Sender & Receiver) confirm the trade.
 */
export class EscrowService {
    /**
     * Holds funds from the sender and marks the transaction as 'PENDING_ESCROW'.
     */
    static async holdFunds(senderId: string, receiverId: string, amount: number, description: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check Sender Balance
            const { rows: sR } = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [senderId]);
            if (sR[0].balance < amount) throw new Error('Insufficient balance to start escrow');

            // 2. Deduct from Sender
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, senderId]);

            // 3. Create Escrow Record
            const txHash = `ESC-${uuidv4().substring(0, 8)}`;
            const { rows: txRows } = await client.query(
                `INSERT INTO transactions(sender_id, receiver_id, amount, type, status, description, tx_hash, metadata)
                 VALUES($1, $2, $3, 'p2p_escrow', 'PENDING_ESCROW', $4, $5, $6) RETURNING id`,
                [senderId, receiverId, amount, description, txHash, JSON.stringify({ escrow_status: EscrowStatus.HELD })]
            );

            await client.query('COMMIT');
            return { transactionId: txRows[0].id, txHash };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Releases funds to the receiver after verifying sender PIN.
     * @param overrideAuth Optional flag for system/AI automated releases
     */
    static async releaseFunds(transactionId: string, userId: string = '', userPin: string = '', overrideAuth: boolean = false) {
        const bcrypt = require('bcryptjs');
        const { decryptPrivateKey } = require('../utils/cryptoUtils');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (!overrideAuth) {
                // 1. Verify User PIN
                const { rows: uR } = await client.query('SELECT pin_hash, encrypted_private_key FROM users WHERE id=$1 FOR UPDATE', [userId]);
                if (!uR.length) throw new Error('User not found');
                const isPinValid = await bcrypt.compare(userPin, uR[0].pin_hash);
                if (!isPinValid) throw new Error('Invalid security PIN');

                // Decrypt Private key (Simulation of Web3 verification)
                try {
                    decryptPrivateKey(uR[0].encrypted_private_key, userPin);
                } catch (e) {
                    throw new Error('Security alert: Signing key recovery failed.');
                }
            }

            const queryArgs = overrideAuth ? [transactionId] : [transactionId, userId];
            const senderCondition = overrideAuth ? '' : 'AND sender_id=$2';
            
            const { rows } = await client.query(`SELECT * FROM transactions WHERE id=$1 ${senderCondition} FOR UPDATE`, queryArgs);
            if (!rows.length || rows[0].status !== 'PENDING_ESCROW') throw new Error('Transaction not in valid escrow state or unauthorized');

            // 2. Credit Receiver
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [rows[0].amount, rows[0].receiver_id]);

            // 3. Mark Transaction Complete
            await client.query(
                'UPDATE transactions SET status = \'SUCCESS\', metadata = jsonb_set(metadata, \'{escrow_status}\', \'"released"\') WHERE id = $1',
                [transactionId]
            );

            await client.query('COMMIT');
            return { success: true };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Disputes an escrow transaction.
     */
    static async disputeFunds(transactionId: string) {
        await pool.query(
            'UPDATE transactions SET status = \'disputed\', metadata = jsonb_set(metadata, \'{escrow_status}\', \'"disputed"\') WHERE id = $1',
            [transactionId]
        );
        return { success: true, message: 'Dispute raised. Admin mediation required.' };
    }

    /**
     * 🤖 AI Auto-Release Logic
     * Checks if the payment conditions are met and auto-releases if the buyer is slow.
     */
    static async verifyAndAutoRelease(transactionId: string) {
        // 1. Check if things are "okay" (Simulating AI/NLP analysis of payment proof)
        const isPaymentVerified = await this.verifyPaymentStatus(transactionId);

        if (isPaymentVerified) {
            console.log(`🤖 [AI MEDIATOR] Auto-releasing funds for TX: ${transactionId} after buyer delay.`);
            return await this.releaseFunds(transactionId, '', '', true);
        }

        throw new Error('Payment not yet verified. Auto-release aborted.');
    }

    /**
     * 🧠 Autonomous Payment Verification
     * In a production environment, this would verify bank webhooks or M-Pesa receipts.
     */
    private static async verifyPaymentStatus(transactionId: string): Promise<boolean> {
        // Mock verification logic: 
        // Checks if an external payment was recorded in our Universal Gateway relative to this escrow.
        const { rows } = await pool.query('SELECT amount, metadata FROM transactions WHERE id=$1', [transactionId]);
        if (!rows.length) return false;

        // Simple check: If the transaction has "verified_proof" in metadata (added by a webhook/bot)
        // For the demo, we will simulate a "positive" check.
        return true;
    }
}
