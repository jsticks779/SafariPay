import { v4 as uuidv4 } from 'uuid';

export class MpesaService {
    /**
     * Simulates a C2B (Customer to Business) payment.
     * In Safaripay, this is used for "On-ramping" (Deposit).
     */
    static async simulateDeposit(phone: string, amount: number) {
        console.log(`[SIMULATION] Triggering M-Pesa STK Push for ${phone}, amount: ${amount} TZS`);

        // Randomly simulate success/failure
        const isSuccess = Math.random() > 0.1;

        return {
            merchantRequestId: uuidv4(),
            checkoutRequestId: uuidv4(),
            responseCode: isSuccess ? "0" : "1",
            responseDescription: isSuccess ? "Success" : "Failed",
            customerMessage: isSuccess ? "Success. Please enter your PIN" : "System busy"
        };
    }

    /**
     * Simulates a B2C (Business to Customer) payment.
     * In Safaripay, this is used for "Off-ramping" (Withdraw).
     */
    static async simulateWithdraw(phone: string, amount: number) {
        console.log(`[SIMULATION] Triggering M-Pesa B2C Payment to ${phone}, amount: ${amount} TZS`);

        const isSuccess = Math.random() > 0.05;

        return {
            originatorConversationId: uuidv4(),
            conversationId: uuidv4(),
            responseCode: isSuccess ? "0" : "1",
            responseDescription: isSuccess ? "Accept the service request successfully." : "Service unavailable",
        };
    }
}
