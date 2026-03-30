import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/database';
import { ethers } from 'ethers';
import { Responder } from '../utils/responder';
import { redisClient } from '../utils/redis';
import { registerSchema, loginSchema } from '../utils/validation';
import { StarknetService } from '../services/starknet.service';
import { FlowService } from '../services/flow.service';
import { encryptPrivateKey, encryptData } from '../utils/cryptoUtils';
import { WalletService } from '../services/wallet.service';
import { SmsService } from '../services/sms_logger.service';
import { OracleService } from '../services/oracle.service';
import { OtpService } from '../services/otp.service';
import { KycService } from '../services/kyc.service';
import { BiometricService } from '../services/biometric.service';
import { logger } from '../utils/logger';
import { BlockchainService } from '../services/blockchain.service';
import { FXService } from '../services/fx.service';

export class AuthController {
    /**
     * @route /api/v1/auth/register
     * Collects: phone, name, email, nida, pin.
     * Generates: wallet_address, encrypted_private_key (with AES-256-GCM + PIN).
     */
    /**
     * @route /api/v1/auth/register
     * Step 1: Collect user info, store in DB with 'LOCKED' status, and send OTP.
     */
    /**
     * @route /api/v1/auth/register
     * SIGNUP: Phone + Name only. (Low Friction)
     */
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const validation = registerSchema.safeParse(req.body);
            if (!validation.success) return Responder.error(res, validation.error.issues[0].message, 400);

            const { phone, name } = validation.data;

            // 1. Check if user already exists
            const { rows: existsRows } = await pool.query('SELECT is_phone_verified FROM users WHERE phone=$1', [phone]);

            if (existsRows.length && existsRows[0].is_phone_verified) {
                return Responder.error(res, 'Account already registered. Please login.', 409);
            }

            if (!existsRows.length) {
                // DON'T INSERT INTO users YET. 
                // We only store the pending registration data in the OTP metadata.
                logger.info('AUTH', `Initiating registration for ${phone}`);
            }

            // 2. Dispatch OTP (Store 'name' in metadata for final registration)
            await OtpService.sendOtp(phone, 'Registration', { name });

            return Responder.ok(res, { phone, step: 'verify_otp' }, 'OTP sent for registration');
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route /api/v1/auth/setup-pin
     * Securely hash and store the transaction PIN after OTP verification.
     */
    static async setupPin(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, pin, name, country, currency } = req.body;
            if (!phone || !pin) return Responder.error(res, 'Phone and PIN required', 400);

            const pinHash = await bcrypt.hash(pin.toString(), 10);

            // Silently Generate Decentralized Identity & Smart Wallet in the background
            const walletData = WalletService.generateWallet(pin, 'TEMP_KYC_ID', phone);

            // FINAL REGISTRATION: Creates the record with full crypto credentials
            // User starts as is_active=false, reward given after onboarding
            const did = `did:safari:${walletData.address}`;
            const query = `
            INSERT INTO users (
                phone, name, pin_hash, wallet_address, eoa_address, did, 
                encrypted_private_key, encrypted_mnemonic, is_phone_verified, 
                trust_level, kyc_status, is_active, balance, reward_balance, credit_score,
                country, currency
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'STARTER', 'pending', false, 0, 0, 300, $9, $10)
            ON CONFLICT (phone) DO UPDATE SET
                pin_hash = EXCLUDED.pin_hash,
                wallet_address = EXCLUDED.wallet_address,
                eoa_address = EXCLUDED.eoa_address,
                did = EXCLUDED.did,
                encrypted_private_key = EXCLUDED.encrypted_private_key,
                encrypted_mnemonic = EXCLUDED.encrypted_mnemonic,
                country = EXCLUDED.country,
                currency = EXCLUDED.currency,
                trust_level = 'STARTER',
                is_active = false
            RETURNING *`;

            const { rows: uRows } = await pool.query(query, [
                phone,
                name || 'User',
                pinHash,
                walletData.smartWalletAddress,
                walletData.address,
                did,
                walletData.encryptedPrivateKey,
                walletData.encryptedMnemonic,
                country || 'TZ',
                currency || 'TZS'
            ]);
            const user = uRows[0];
            const token = jwt.sign({ id: user.id, phone: user.phone }, process.env.JWT_SECRET!, { expiresIn: '7d' });

            logger.info('AUTH', `Registration initialized for ${phone}. Onboarding pending.`);
            return Responder.ok(res, { user, token }, 'Registration initialized. Please complete onboarding.');
        } catch (e: any) {
            next(e);
        }
    }
    /**
     * @route /api/v1/auth/verify-otp
     * Step 2: Verify OTP to activate/authenticate account.
     */
    static async verifyOtp(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, code, device_id } = req.body;
            if (!phone || !code) return Responder.error(res, 'Phone and code are required', 400);

            // 1. Verify OTP using OtpService
            const { valid: isValid, metadata } = await OtpService.verifyOtpWithMetadata(phone, code);
            if (!isValid) return Responder.error(res, 'Invalid or expired OTP', 401);

            const { rows } = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
            const user = rows[0];

            if (user && !user.is_phone_verified) {
                await pool.query('UPDATE users SET is_phone_verified=true WHERE id=$1', [user.id]);
            }

            // 🧠 [Silent Security] Device Fingerprinting
            const ip = req.ip || req.headers['x-forwarded-for'];
            if (user && device_id) {
                const { rows: dRows } = await pool.query('SELECT id FROM devices WHERE user_id=$1 AND device_hash=$2', [user.id, device_id]);

                // If this is a NEW DEVICE for this user, send a security alert SMS
                if (!dRows.length) {
                    const alertMsg = `SafariPay Security: A new device just logged into your account. If this was not you, please contact support immediately!`;
                    await SmsService.sendSms(phone, alertMsg, 'SECURITY');
                    logger.warn('SECURITY', `New device detected for ${phone}: ${device_id}`);
                }

                await pool.query(
                    `INSERT INTO devices (user_id, device_hash, ip_address, last_active)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (user_id, device_hash) DO UPDATE SET last_active=NOW(), ip_address=$3`,
                    [user.id, device_id, ip]
                );
            }

            // Security Update: NEVER return the session token here.
            // The user MUST provide their PIN in the next step to get the token.
            return Responder.ok(res, {
                phone,
                needs_pin_setup: !user?.pin_hash,
                metadata: metadata || {} // Pass 'name' from registration back to frontend if needed
            }, 'OTP verified. Please proceed to PIN step.');
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route /api/v1/auth/login
     * Dual-Mode: PIN Login for established accounts, or OTP Trigger for verification/forgot.
     */
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            let { phone, pin } = req.body;
            phone = phone?.replace(/\s+/g, '')?.trim();
            const { rows } = await pool.query(
                `SELECT id, phone, name, email, balance, reward_balance, credit_score, did, 
                        country, currency, account_type, trust_level, is_phone_verified, is_active,
                        pin_hash, created_at 
                 FROM users
                 WHERE phone=$1`,
                [phone]
            );
            if (!rows.length) return Responder.error(res, 'User not found. Please register.', 404);

            const user = rows[0];

            // Primary: PIN Login (Fast Path)
            if (pin && user.pin_hash) {
                const isValid = await bcrypt.compare(pin.toString(), user.pin_hash);
                if (isValid) {
                    const token = jwt.sign({ id: user.id, phone }, process.env.JWT_SECRET!, { expiresIn: '7d' });

                    // Device fingerprinting on normal login
                    const ip = req.ip || req.headers['x-forwarded-for'];
                    await pool.query(
                        `INSERT INTO devices (user_id, device_hash, ip_address, last_active) 
                         VALUES ($1, $2, $3, NOW())
                         ON CONFLICT (user_id, device_hash) DO UPDATE SET last_active=NOW()`,
                        [user.id, req.body.device_id || 'mobile_app', ip]
                    );

                    const { pin_hash, ...safeUser } = user;
                    return Responder.ok(res, { user: safeUser, token }, 'Login successful');
                }
                return Responder.error(res, 'Incorrect PIN. Try again or reset.', 401);
            }

            // Fallback: Send OTP if no PIN provided or for first-time login step
            await OtpService.sendOtp(phone, 'Security Pin/Login');
            return Responder.ok(res, { phone, step: 'verify_otp' }, 'Security code sent to your phone');
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route /api/v1/auth/forgot-pin
     * Recovery flow: phone → simulate OTP → reset pin.
     */
    static async forgotPin(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, newPin, otp } = req.body;
            if (!phone) return Responder.error(res, 'Phone number required', 400);

            // Fetch user to get their registered email
            const { rows: userRows } = await pool.query('SELECT email, name FROM users WHERE phone=$1', [phone]);
            if (!userRows.length) return Responder.error(res, 'Account not registered', 404);

            const userEmail = userRows[0].email;
            const userName = userRows[0].name;

            // Step 1: Request OTP
            if (!newPin && !otp) {
                const generatedOtp = '8888'; // Keeping 8888 for easy testing but sending via service

                // Send via SMS
                await SmsService.sendSms(
                    phone,
                    `SafariPay Security Alert: Your PIN reset code is ${generatedOtp}. Do not share this with anyone.`,
                    'OTP'
                );

                // Send via Email (Dual-Mode)
                if (userEmail) {
                    await SmsService.sendEmail(
                        userEmail,
                        `Hello ${userName}, your SafariPay security PIN reset code is ${generatedOtp}. If you did not request this, please secure your account immediately.`,
                        'OTP'
                    );
                }

                return Responder.ok(res, {}, 'Recovery OTP sent to your registered phone and email! Check the Simulator Dashboard.');
            }

            // Step 2: Reset PIN
            if (newPin && otp === '8888') {
                const pin_hash = await bcrypt.hash(newPin, 10);

                // 🔄 [Wallet Rotation] Since we cannot decrypt the old key without the old PIN,
                // we generate a new secure anchor for the user.
                const newWallet = ethers.Wallet.createRandom();
                const encrypted_private_key = encryptPrivateKey(newWallet.privateKey, newPin);

                await pool.query(
                    'UPDATE users SET pin_hash=$1, wallet_address=$2, encrypted_private_key=$3 WHERE phone=$4',
                    [pin_hash, newWallet.address, encrypted_private_key, phone]
                );

                await SmsService.sendSms(
                    phone,
                    `Success: Your SafariPay security PIN has been updated. If you didn't do this, contact support immediately.`,
                    'SYSTEM'
                );

                if (userEmail) {
                    await SmsService.sendEmail(
                        userEmail,
                        `Security Alert: Your SafariPay security PIN was successfully updated. If this wasn't you, please lock your account.`,
                        'SECURITY'
                    );
                }

                return Responder.ok(res, {}, 'PIN successfully updated');
            }

            return Responder.error(res, 'Invalid verification code or input', 400);
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/restore
     * Restore wallet from seed phrase + phone.
     */
    static async restoreWallet(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, mnemonic, newPin } = req.body;
            if (!phone || !mnemonic || !newPin) {
                return Responder.error(res, 'Phone, mnemonic, and new PIN are required', 400);
            }

            // 1. Fetch user
            const { rows } = await pool.query('SELECT id, phone FROM users WHERE phone = $1', [phone]);
            if (!rows.length) return Responder.error(res, 'Account not found. Please register first.', 404);

            const user = rows[0];

            // 2. Recover wallet from mnemonic
            try {
                const recovered = WalletService.recoverFromMnemonic(mnemonic, newPin);

                // 3. Update DB with new secure anchor
                const pinHash = await bcrypt.hash(newPin, 10);
                const encryptedMnemonic = encryptData(mnemonic);

                await pool.query(
                    `UPDATE users 
                     SET pin_hash = $1, 
                         encrypted_private_key = $2, 
                         encrypted_mnemonic = $3,
                         wallet_address = $4,
                         is_active = true,
                         trust_level = CASE WHEN trust_level = 'LOCKED' THEN 'LOW' ELSE trust_level END
                     WHERE id = $5`,
                    [pinHash, recovered.encryptedPrivateKey, encryptedMnemonic, recovered.address, user.id]
                );

                logger.info('AUTH', `Account restored via seed phrase for ${phone}`);

                return Responder.ok(res, {}, 'Account successfully restored. Please login with your new PIN.');
            } catch (err: any) {
                return Responder.error(res, 'Invalid recovery phrase. Please check your words and try again.', 401);
            }
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/biometric/register-challenge
     */
    static async biometricRegisterChallenge(req: any, res: Response, next: NextFunction) {
        try {
            const options = await BiometricService.getRegistrationOptions(req.user.id, req.user.phone);
            await redisClient.setex(`biometric_challenge:${req.user.id}`, 300, options.challenge);
            return Responder.ok(res, options);
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/biometric/register-finish
     */
    static async biometricRegisterFinish(req: any, res: Response, next: NextFunction) {
        try {
            const expectedChallenge = await redisClient.get(`biometric_challenge:${req.user.id}`);
            if (!expectedChallenge) return Responder.error(res, 'Challenge expired', 400);

            const success = await BiometricService.verifyRegistration(req.user.id, req.body, expectedChallenge);
            if (success) {
                await redisClient.del(`biometric_challenge:${req.user.id}`);
                return Responder.ok(res, {}, 'Biometric fingerprint/FaceID registered successfully');
            }
            return Responder.error(res, 'Biometric registration failed', 400);
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/biometric/login-challenge
     */
    static async biometricLoginChallenge(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone } = req.body;
            if (!phone) return Responder.error(res, 'Phone number required', 400);

            const { rows } = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
            if (!rows.length) return Responder.error(res, 'User not found', 404);

            const options = await BiometricService.getAuthenticationOptions(rows[0].id);
            await redisClient.setex(`biometric_login_challenge:${rows[0].id}`, 300, options.challenge);

            return Responder.ok(res, { userId: rows[0].id, ...options });
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/biometric/login-finish
     */
    static async biometricLoginFinish(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, body } = req.body;
            if (!userId || !body) return Responder.error(res, 'UserId and biometric response required', 400);

            const expectedChallenge = await redisClient.get(`biometric_login_challenge:${userId}`);
            if (!expectedChallenge) return Responder.error(res, 'Challenge expired', 400);

            const success = await BiometricService.verifyAuthentication(userId, body, expectedChallenge);
            if (success) {
                await redisClient.del(`biometric_login_challenge:${userId}`);

                const { rows } = await pool.query('SELECT id, phone, name, account_type, trust_level FROM users WHERE id = $1', [userId]);
                const user = rows[0];

                const token = jwt.sign(
                    { id: user.id, phone: user.phone, account_type: user.account_type, trust_level: user.trust_level },
                    process.env.JWT_SECRET!,
                    { expiresIn: '7d' }
                );

                return Responder.ok(res, { user, token }, 'Biometric login successful');
            }
            return Responder.error(res, 'Biometric authentication failed', 401);
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/decentralized-recovery
     * Verifies OTP + NIDA off-chain and returns a Guardian Signature for the Smart Contract.
     */
    static async requestDecentralizedRecovery(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, nida, otp, newDeviceAddress } = req.body;
            if (!phone || !nida || !otp || !newDeviceAddress) {
                return Responder.error(res, 'Phone, NIDA, OTP, and New Device Address are required', 400);
            }

            // 1. Double check OTP
            const ok = await OtpService.verifyOtp(phone, otp);
            if (!ok) return Responder.error(res, 'Invalid or expired OTP', 401);

            // 2. Lookup User and Smart Wallet
            const { rows } = await pool.query(
                'SELECT wallet_address, nida_number FROM users WHERE phone = $1',
                [phone]
            );
            if (!rows.length) return Responder.error(res, 'User not found', 404);

            const user = rows[0];
            if (user.nida_number !== nida) {
                return Responder.error(res, 'Identity verification failed: NIDA mismatch', 403);
            }

            // 3. Generate Guardian Signature for On-Chain Recovery
            // We need the current nonce from the blockchain
            const walletAddress = user.wallet_address;

            // For the demo, we'll try to fetch the nonce from the contract
            let nonce = 0n;
            try {
                const smartWallet = BlockchainService.getContract('SAFARI_SMART_WALLET', undefined, walletAddress);
                nonce = await smartWallet.nonce();
            } catch {
                nonce = 0n; // Fallback for simulation
            }

            const signature = await BlockchainService.signRecovery(newDeviceAddress, nonce, walletAddress);

            logger.info('AUTH', `Decentralized recovery signature generated for ${phone}`);

            return Responder.ok(res, {
                guardianSignature: signature,
                nonce: nonce.toString(),
                smartWalletAddress: walletAddress,
                message: 'Recovery proof generated. You can now submit this to the blockchain to restore your funds.'
            });

        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route /api/v1/auth/me
     */
    static async me(req: any, res: Response, next: NextFunction) {
        try {
            if (req.user.id === 'admin') {
                return Responder.ok(res, { id: 'admin', role: 'admin', is_active: true, phone: 'System Admin' });
            }

            const cacheKey = `user_profile:${req.user.id}`;
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return Responder.ok(res, JSON.parse(cached));
            }

            const { rows } = await pool.query(
                `SELECT u.id, u.phone, u.name, u.email, u.balance, u.reward_balance, u.credit_score, u.did, 
                        u.country, u.currency, u.account_type, u.trust_level, u.is_phone_verified, u.is_active,
                        i.verification_status, i.id_type, u.wallet_address, u.created_at 
                 FROM users u
                 LEFT JOIN identity i ON u.id = i.user_id
                 WHERE u.id=$1`,
                [req.user.id]
            );
            if (!rows.length) return Responder.error(res, 'User not found', 404);

            await redisClient.setex(cacheKey, 300, JSON.stringify(rows[0]));

            return Responder.ok(res, rows[0]);
        } catch (e: any) {
            next(e);
        }
    }
    /**
     * @route POST /api/v1/auth/kyc-profile
     */
    static async onboardingKycProfile(req: any, res: Response, next: NextFunction) {
        try {
            const { first_name, last_name, country, address, email, dob } = req.body;
            const fullName = `${first_name} ${last_name}`.trim();

            const currencyMap: Record<string, string> = {
                'TZ': 'TZS', 'KE': 'KES', 'UG': 'UGX', 'US': 'USD', 'GB': 'GBP', 'NG': 'NGN', 'ZA': 'ZAR'
            };
            const currency = currencyMap[country] || 'USD'; // global safe fallback

            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE');
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255)');

            await pool.query(
                `UPDATE users SET name=$1, country=$2, currency=$3, address=$4, email=$5, dob=$6 WHERE id=$7`,
                [fullName, country, currency, address, email || null, dob || null, req.user.id]
            );
            await redisClient.del(`user_profile:${req.user.id}`);

            return Responder.ok(res, {}, 'KYC profile saved');
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/kyc-verify
     */
    static async onboardingKycVerify(req: any, res: Response, next: NextFunction) {
        try {
            const { skip, idType, idNumber, documentCountry } = req.body;

            if (skip) {
                await pool.query("UPDATE users SET kyc_status='pending', trust_level='STARTER' WHERE id=$1", [req.user.id]);
                await redisClient.del(`user_profile:${req.user.id}`);
                return Responder.ok(res, { verified: false }, 'Skip recorded. Verification can be completed later.');
            }

            // Implement Shufti Pro Global KYC & AML Verification logic
            const userData = { idType, idNumber, documentCountry };
            const images = { id_document: true, selfie: true };
            
            const shuftiResponse = await KycService.processShuftiProVerification(req.user.id, userData, images);

            await redisClient.del(`user_profile:${req.user.id}`);
            
            if (shuftiResponse.aml_result === 'clear') {
                return Responder.ok(res, { verified: true, shuftiResponse }, 'Identity verified successfully!');
            } else {
                return Responder.error(res, 'Verification failed due to AML Watchlist Flag', 400);
            }
        } catch (e: any) {
            next(e);
        }
    }

    /**
     * @route POST /api/v1/auth/accept-terms
     */
    static async onboardingAcceptTerms(req: any, res: Response, next: NextFunction) {
        try {
            // 1. Mark as active
            await pool.query("UPDATE users SET is_active=true WHERE id=$1", [req.user.id]);
            await redisClient.del(`user_profile:${req.user.id}`);

            // 2. Fetch user details for reward
            const { rows } = await pool.query('SELECT phone, reward_balance, currency FROM users WHERE id=$1', [req.user.id]);
            const user = rows[0];

            if (!user) {
                return Responder.error(res, 'User record not found during final activation', 404);
            }

            // 3. Give 0.20 USDT Welcome Reward (Converted to Local Reality)
            if (Number(user.reward_balance || 0) === 0) {
                const amount = 500; // 0.20 USDT equivalent (Platform Base: TZS)
                const rewardCurrency = user.currency || 'TZS';

                await pool.query('UPDATE users SET reward_balance = $1 WHERE id=$2', [amount, req.user.id]);
                await pool.query(
                    `INSERT INTO transactions (receiver_id, receiver_phone, amount, type, status, description)
                     VALUES ($1, $2, $3, 'top_up', 'completed', 'Welcome Fee Credit (Makato)')`,
                    [req.user.id, user.phone, amount]
                );

                // 4. Send Confirmation SMS (Dynamic Localization for SMS only)
                const welcomeMsg = `SafariPay: Setup complete! 🎉 You've received a welcome reward. Your Smart Wallet is fully active.`;
                await SmsService.sendSms(user.phone, welcomeMsg, 'SYSTEM');
            }

            return Responder.ok(res, {}, 'Onboarding complete! Welcome to SafariPay.');
        } catch (e: any) {
            next(e);
        }
    }
}
