/**
 * Simulated SMS Controller
 * Simulates sending OTP and transactional SMS delivery in Testnet
 */
export class BriqSmsController {
    /**
     * Simulates sending a SMS by printing to terminal
     * @param phone Recipient phone number
     * @param message The message content
     */
    static async sendSms(phone: string, message: string) {
        console.log(`\n\x1b[32m[SMS SENT]\x1b[0m 📱 To: ${phone}`);
        console.log(`\x1b[32m[SMS SENT]\x1b[0m 💬 Message: ${message}\n`);
        return true;
    }

    /**
     * Sends an OTP message simulation
     */
    static async sendSafariPayOTP(phone: string, code: string) {
        const message = `Your SafariPay code is ${code}. Use it to verify your account.`;
        return this.sendSms(phone, message);
    }
}
