/**
 * SafariPay — Biometric Authentication Service (Passkeys/WebAuthn)
 * ==============================================================
 * This service enables secure biometric login (Fingerprint/FaceID) 
 * without storing actual biometric data on the server.
 */

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import pool from '../db/database';
import { logger } from '../utils/logger';

// Configurations
const rpName = 'SafariPay Global';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

export class BiometricService {

    /**
     * Step 1 (Register): Generate options for the browser to create a new biometric key.
     */
    static async getRegistrationOptions(userId: string, userName: string) {
        const { rows: existingCredentials } = await pool.query(
            'SELECT credential_id FROM biometric_credentials WHERE user_id = $1',
            [userId]
        );

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: Buffer.from(userId),
            userName: userName,
            attestationType: 'none',
            excludeCredentials: existingCredentials.map((cred: any) => ({
                id: cred.credential_id,
                type: 'public-key',
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform', // Enforce platform biometrics (TouchID/FaceID)
            },
        });

        return options;
    }

    /**
     * Step 2 (Register): Verify the biometric credential and save the public key.
     */
    static async verifyRegistration(userId: string, body: any, expectedChallenge: string) {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;

            // Store in DB
            await pool.query(
                `INSERT INTO biometric_credentials (user_id, credential_id, public_key, counter, device_name)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    credential.id,
                    Buffer.from(credential.publicKey).toString('base64url'),
                    credential.counter,
                    body.authenticatorAttachment || 'Biometric Device',
                ]
            );

            logger.info('SECURITY', `Biometric credential registered for user ${userId}`);
            return true;
        }

        return false;
    }

    /**
     * Step 1 (Login): Generate options for the browser to sign a challenge using biometrics.
     */
    static async getAuthenticationOptions(userId: string) {
        const { rows: credentials } = await pool.query(
            'SELECT credential_id FROM biometric_credentials WHERE user_id = $1',
            [userId]
        );

        if (credentials.length === 0) throw new Error('No biometric credentials registered for this user.');

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: credentials.map((cred: any) => ({
                id: cred.credential_id,
                type: 'public-key',
                transports: ['internal'],
            })),
            userVerification: 'preferred',
        });

        return options;
    }

    /**
     * Step 2 (Login): Verify the biometric signature.
     */
    static async verifyAuthentication(userId: string, body: any, expectedChallenge: string) {
        const { rows: credentials } = await pool.query(
            'SELECT * FROM biometric_credentials WHERE credential_id = $1 AND user_id = $2',
            [body.id, userId]
        );

        if (credentials.length === 0) throw new Error('Credential not found.');

        const dbCred = credentials[0];

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: dbCred.credential_id,
                publicKey: Buffer.from(dbCred.public_key, 'base64url'),
                counter: parseInt(dbCred.counter),
            },
        });

        if (verification.verified) {
            // Update counter to prevent replay attacks
            await pool.query(
                'UPDATE biometric_credentials SET counter = $1, last_used_at = NOW() WHERE credential_id = $2',
                [verification.authenticationInfo.newCounter, dbCred.credential_id]
            );

            logger.info('SECURITY', `Biometric login successful for user ${userId}`);
            return true;
        }

        return false;
    }
}
