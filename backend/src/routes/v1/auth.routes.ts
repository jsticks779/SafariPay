import { Router } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import { auth } from '../../middleware/auth';

const router = Router();

/**
 * @api /api/v1/auth/register
 * @method POST
 */
router.post('/register', AuthController.register);

/**
 * @api /api/v1/auth/login
 * @method POST
 */
router.post('/login', AuthController.login);

/**
 * @api /api/v1/auth/setup-pin
 * @method POST
 */
router.post('/setup-pin', AuthController.setupPin);

/**
 * @api /api/v1/auth/verify-otp
 * @method POST
 */
router.post('/verify-otp', AuthController.verifyOtp);

/**
 * @api /api/v1/auth/restore
 * @method POST
 */
router.post('/restore', AuthController.restoreWallet);
router.post('/decentralized-recovery', AuthController.requestDecentralizedRecovery);

/**
 * @api /api/v1/auth/forgot-pin
 * @method POST
 */
router.post('/forgot-pin', AuthController.forgotPin);

/**
 * BIOMETRIC (FINGERPRINT/FACEID) FLOWS
 */
router.post('/biometric/register-challenge', auth, AuthController.biometricRegisterChallenge);
router.post('/biometric/register-finish', auth, AuthController.biometricRegisterFinish);
router.post('/biometric/login-challenge', AuthController.biometricLoginChallenge);
router.post('/biometric/login-finish', AuthController.biometricLoginFinish);

/**
 * @api /api/v1/auth/me
 * @method GET
 */
router.get('/me', auth, AuthController.me);

router.post('/kyc-profile', auth, AuthController.onboardingKycProfile);
router.post('/kyc-verify', auth, AuthController.onboardingKycVerify);
router.post('/accept-terms', auth, AuthController.onboardingAcceptTerms);

export default router;
