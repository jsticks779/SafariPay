/**
 * SafariPay — Crypto Utility Service (Production-Ready)
 * ======================================================
 * AES-256-GCM encryption with scrypt key derivation.
 * Used for encrypting blockchain private keys with the user's PIN.
 *
 * Security model:
 *   key = scrypt(PIN + ENVIRONMENT_SECRET, salt)
 *   ciphertext = AES-256-GCM(key, iv, privateKey)
 *   stored = salt:iv:authTag:ciphertext  (all hex)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENV_SECRET = process.env.ENVIRONMENT_SECRET || '';

// ─── Production Safety Check ────────────────────────────────────────
const UNSAFE_DEFAULTS = [
    'safaripay-default-dev-secret-do-not-use-in-prod',
    'safaripay_node_crypto_utility_secret_2025_prod_v1',
    '',
];

if (process.env.NODE_ENV === 'production' && UNSAFE_DEFAULTS.includes(ENV_SECRET)) {
    console.error('⛔ [SECURITY] FATAL: ENVIRONMENT_SECRET is not set or is using a default value!');
    console.error('   Set a strong, unique ENVIRONMENT_SECRET in your production .env');
    process.exit(1);
}

// ─── PIN Validation ─────────────────────────────────────────────────
function validatePin(pin: string): void {
    if (!pin || pin.length < 4 || pin.length > 8) {
        throw new Error('PIN must be 4-8 characters');
    }
}

/**
 * Encrypts a blockchain private key using user's PIN and environment secret.
 * @param privateKey Plain text private key
 * @param userPin User's PIN (4-8 digits)
 * @returns Colon-separated string: salt:iv:tag:encryptedContent
 */
export function encryptPrivateKey(privateKey: string, userPin: string): string {
    validatePin(userPin);

    if (!privateKey || privateKey.length < 10) {
        throw new Error('Invalid private key format');
    }

    // 1. Generate unique salt for scrypt
    const salt = crypto.randomBytes(16);

    // 2. Derive 256-bit key from PIN + ENV_SECRET via scrypt
    //    N=16384, r=8, p=1 — resistant to GPU/ASIC brute-force
    const key = crypto.scryptSync(userPin + ENV_SECRET, salt, 32);

    // 3. Setup AES-GCM with random IV
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // 4. Return combined metadata (all hex, colon-separated)
    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Encrypts generic sensitive data using only the environment secret.
 * Used for storing IDs and other non-blockchain credentials.
 */
export function encryptData(data: string): string {
    if (!data) throw new Error('No data provided to encrypt');

    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENV_SECRET, salt, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted private key string.
 * @param encryptedKey Colon-separated string (salt:iv:tag:content)
 * @param userPin User's PIN provided during transaction
 * @returns Decrypted private key string
 * @throws Error if PIN is incorrect or data is tampered
 */
export function decryptPrivateKey(encryptedKey: string, userPin: string): string {
    validatePin(userPin);

    try {
        const parts = encryptedKey.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted key format: expected 4 segments');
        }

        const [saltHex, ivHex, tagHex, encryptedHex] = parts;

        if (!saltHex || !ivHex || !tagHex || !encryptedHex) {
            throw new Error('Invalid encrypted key format: empty segments');
        }

        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        // 1. Re-derive key using the stored salt
        const key = crypto.scryptSync(userPin + ENV_SECRET, salt, 32);

        // 2. Setup decipher with auth tag
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        // 3. Decrypt and verify (GCM auth tag validates integrity)
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err: any) {
        // Distinguish between format errors and PIN errors
        if (err.message.includes('Unsupported state') || err.message.includes('unable to authenticate')) {
            throw new Error('PIN verification failed: incorrect PIN or corrupted data');
        }
        throw new Error(`Decryption failed: ${err.message}`);
    }
}

/**
 * Decrypts data encrypted via encryptData.
 */
export function decryptData(encryptedData: string): string {
    try {
        const [saltHex, ivHex, tagHex, encryptedHex] = encryptedData.split(':');
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        const key = crypto.scryptSync(ENV_SECRET, salt, 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err: any) {
        throw new Error('General decryption failed: ' + err.message);
    }
}
