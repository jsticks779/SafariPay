import { z } from 'zod';

// Registration Validation Strict Rules
// 🟢 NEW: Minimalist Signup (Low Friction)
export const registerSchema = z.object({
    phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
    name: z.string().min(2, 'Name is too short')
});

// 🔵 Login: Phone number only for OTP trigger
export const loginSchema = z.object({
    phone: z.string().min(10, 'Invalid phone number length')
});

// 🔐 Post-Signup/Verification: Create Secure Transaction PIN
export const setupPinSchema = z.object({
    pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d+$/, 'PIN must contain only numbers')
});

// OTP Verification Rules
export const verifyOtpSchema = z.object({
    phone: z.string().min(10, 'Invalid phone length'),
    code: z.string().length(6, 'OTP must be exactly 6 digits')
});

// Transaction Transfer Rules & Basic Fraud Limit Checks
export const sendTransactionSchema = z.object({
    receiver_phone: z.string().min(10, 'Invalid receiver phone length'),
    amount: z.number().positive().max(5000000, "Fraud Alert: Over transaction limit (Max 5,000,000 TZS)"),
    description: z.string().optional()
});

/**
 * 🌍 [JUDGE DEMO] Global Network Matrix
 * Standardizes prefixes to actual providers across SafariPay regions.
 */
export const getNetworkProvider = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    
    // Kenya (+254)
    if (clean.startsWith('254')) {
        const p = clean.slice(3, 5);
        if (['70', '71', '72', '79', '11'].includes(p)) return 'Safaricom M-Pesa';
        if (['73', '75', '78'].includes(p)) return 'Airtel Money';
        return 'Safaricom';
    }
    
    // Uganda (+256)
    if (clean.startsWith('256')) {
        const p = clean.slice(3, 5);
        if (['77', '78'].includes(p)) return 'MTN MoMo';
        if (['75', '70'].includes(p)) return 'Airtel Money';
        return 'MTN';
    }
    
    // Tanzania (+255) - Fallback/Default
    const p = clean.startsWith('255') ? clean.slice(3, 6) : clean.slice(1, 4);
    if (['74', '75', '76'].includes(p)) return 'Vodacom M-Pesa';
    if (['65', '67', '71'].includes(p)) return 'Tigo Pesa';
    if (['68', '69', '78'].includes(p)) return 'Airtel Money';
    if (['61', '62'].includes(p)) return 'Halopesa';
    
    return 'Vodacom M-Pesa'; // Default
};

export const getCurrencyByPhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('254')) return 'KES';
    if (clean.startsWith('256')) return 'UGX';
    return 'TZS';
};
