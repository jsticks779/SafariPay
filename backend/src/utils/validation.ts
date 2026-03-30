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
