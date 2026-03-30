import { Router } from 'express';
import { KycController } from '../../controllers/kyc.controller';
import { auth } from '../../middleware/auth';
import { upload } from '../../middleware/upload';

const router = Router();

/**
 * @api /api/v1/kyc/upload-selfie
 * @method POST
 */
router.post('/upload-selfie', auth, upload.single('selfie'), KycController.uploadSelfie);

/**
 * @api /api/v1/kyc/upload-id
 * @method POST
 */
router.post('/upload-id', auth, upload.single('id_image'), KycController.uploadId);

/**
 * @api /api/v1/kyc/verify
 * @method POST
 */
router.post('/verify', auth, KycController.verify);

/**
 * @api /api/v1/kyc/status
 * @method GET
 */
router.get('/status', auth, KycController.getStatus);

export default router;
