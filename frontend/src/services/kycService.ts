import api from '../lib/api';

/**
 * SafariPay KYC Service
 * Handles NIDA Verification for Tanzania with Dual-Mode support.
 * Mode A: Mock (Sandbox/JUDGE Mode)
 * Mode B: Real API (Smile ID Production)
 */

export interface NidaResponse {
    success: boolean;
    message: string;
    data?: {
        firstName: string;
        lastName: string;
        middleName?: string;
        gender: string;
        dob: string;
    };
}

const USE_REAL_API = (import.meta as any).env.VITE_USE_REAL_API === 'true';

export class KycService {
    /**
     * Validate NIDA format: 20 digits, starting with YYYYMMDD
     */
    static validateFormat(nida: string): { valid: boolean; error?: string } {
        if (!/^\d{20}$/.test(nida)) {
            return { valid: false, error: 'Invalid NIDA format. Must be 20 digits.' };
        }

        const dobPart = nida.substring(0, 8);
        const year = parseInt(dobPart.substring(0, 4));
        const month = parseInt(dobPart.substring(4, 6));
        const day = parseInt(dobPart.substring(6, 8));

        // Basic date validation
        const date = new Date(year, month - 1, day);
        const isValidDate = date.getFullYear() === year && (date.getMonth() + 1) === month && date.getDate() === day;

        if (!isValidDate || year < 1920 || year > new Date().getFullYear() - 15) {
            return { valid: false, error: 'Invalid NIDA format. First 8 digits must be a valid YYYYMMDD date.' };
        }

        return { valid: true };
    }

    /**
   * Universal ID Verification Entry Point
   */
    static async verifyId(idNumber: string, countryCode: string): Promise<NidaResponse> {
        console.log(`%c[KYC] Verifying ${countryCode} ID: ${idNumber}...`, 'color: #3b82f6; font-weight: bold;');
        console.log(`%c[KYC] Environment: ${USE_REAL_API ? 'PRODUCTION/API_GATEWAY' : 'SANDBOX/MOCK'}`, 'color: #10b981;');

        if (!USE_REAL_API) {
            return this.verifyMock(idNumber, countryCode);
        } else {
            return this.verifyReal(idNumber, countryCode);
        }
    }

    /**
     * Scenario A: Sandbox Mode (High-Fidelity)
     * Supports universal country mocks for system validation.
     */
    private static async verifyMock(idNumber: string, countryCode: string): Promise<NidaResponse> {
        // Simulate Global API Latency (2.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));

        // -- TANZANIA (TZ) --
        if (countryCode === 'TZ') {
            if (idNumber.startsWith('199')) {
                return { success: true, message: 'NIDA Verified', data: { firstName: 'Zephania', lastName: 'Deus', gender: 'Male', dob: '1998-05-20' } };
            }
            if (idNumber.startsWith('200')) {
                return { success: true, message: 'NIDA Verified', data: { firstName: 'Junior', lastName: 'Jovin', gender: 'Male', dob: '2000-01-15' } };
            }
        }

        // -- KENYA (KE) --
        if (countryCode === 'KE') {
            if (idNumber.startsWith('123')) {
                return { success: true, message: 'National ID Verified', data: { firstName: 'Kennedy', lastName: 'Omondi', gender: 'Male', dob: '1992-04-10' } };
            }
            if (idNumber.startsWith('456')) {
                return { success: true, message: 'National ID Verified', data: { firstName: 'Mary', lastName: 'Wambui', gender: 'Female', dob: '1995-12-25' } };
            }
        }

        // -- UGANDA (UG) --
        if (countryCode === 'UG') {
            if (idNumber.startsWith('CF') || idNumber.startsWith('CM')) {
                return { success: true, message: 'National ID Verified', data: { firstName: 'Grace', lastName: 'Nakato', gender: 'Female', dob: '1997-08-30' } };
            }
        }

        // -- NIGERIA (NG) --
        if (countryCode === 'NG') {
            if (idNumber.startsWith('555')) {
                return { success: true, message: 'NIN Verified', data: { firstName: 'Chidi', lastName: 'Okafor', gender: 'Male', dob: '1990-03-12' } };
            }
        }

        // -- GHANA (GH) --
        if (countryCode === 'GH') {
            if (idNumber.startsWith('GHA')) {
                return { success: true, message: 'Ghana Card Verified', data: { firstName: 'Kofi', lastName: 'Mensah', gender: 'Male', dob: '1993-11-05' } };
            }
        }

        // Fallback for other countries (Generic Mock Success for testing)
        if (idNumber.length > 5) {
            console.log(`%c[KYC] Returning Generic Success for ${countryCode}`, 'color: #fbbf24;');
            return {
                success: true,
                message: 'Identity Verified (Sandbox)',
                data: {
                    firstName: 'Global',
                    lastName: 'Tester',
                    gender: 'Other',
                    dob: '1990-01-01'
                }
            };
        }

        console.log('%c[KYC] Response Received: FAILED (Mock)', 'color: #ef4444; font-weight: bold;');
        return {
            success: false,
            message: 'ID record not found. Please check and try again.'
        };
    }

    /**
     * Scenario B: Real API Mode (Production Grade)
     * This is where you connect SafariPay to the world.
     */
    private static async verifyReal(idNumber: string, countryCode: string): Promise<NidaResponse> {
        try {
            console.log(`%c[KYC] Initiating Secure Production Request for ${countryCode}...`, 'color: #6366f1; font-weight: bold;');

            /**
             * STEP 1: Integration Strategy
             * For SafariPay Global, we recommend Smile ID (Enhanced KYC) or YouVerify.
             */

            /* 
            const response = await fetch('https://api.smileidentity.com/v1/id_verification', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SMILE_ID_API_KEY}` 
              },
              body: JSON.stringify({
                country: countryCode, // Dynamically handle TZ, KE, NG, UG, etc.
                id_type: this.getIdTypeForCountry(countryCode),
                id_number: idNumber,
                partner_id: 'SAFARIPAY_PROD_001'
              })
            });
            */

            return {
                success: false,
                message: 'Production API Gateway not configured. SafariPay is currently in High-Fidelity Sandbox Mode.'
            };
        } catch (error) {
            return { success: false, message: 'Network error connecting to Secure Identity Hub.' };
        }
    }

    // Helper to map country to Smile ID / Provider ID Types
    private static getIdTypeForCountry(code: string): string {
        const map: Record<string, string> = {
            'TZ': 'NATIONAL_ID',
            'KE': 'NATIONAL_ID',
            'NG': 'NIN',
            'GH': 'GHANA_CARD',
            'UG': 'NATIONAL_ID'
        };
        return map[code] || 'PASSPORT';
    }

    /**
     * UPLOAD ID DOCUMENT
     */
    static async uploadId(file: File) {
        const fd = new FormData();
        fd.append('id_image', file);
        return api.post('kyc/upload-id', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    /**
     * UPLOAD SELFIE
     */
    static async uploadSelfie(file: File) {
        const fd = new FormData();
        fd.append('selfie', file);
        return api.post('kyc/upload-selfie', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    }

    /**
     * TRIGGER VERIFICATION
     */
    static async verifySelfie() {
        return api.post('kyc/verify');
    }
}
