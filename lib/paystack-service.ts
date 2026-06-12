import { trpcClient } from './trpc';

export interface PaystackPaymentData {
  amount: number;
  email: string;
  reference?: string;
  currency?: string;
  metadata?: Record<string, any>;
  channels?: string[];
  callback_url?: string;
}

export interface PaystackResponse {
  status: boolean;
  message: string;
  data?: any;
}

export class PaystackService {
  static generateReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `TXN-${timestamp}-${random}`;
  }

  static async initializeTransaction(data: PaystackPaymentData): Promise<PaystackResponse> {
    try {
      const result = await trpcClient.payments.paystack.initialize.mutate({
        amount: data.amount,
        email: data.email,
        reference: data.reference,
        callback_url: data.callback_url,
        metadata: data.metadata,
      });

      return result as PaystackResponse;
    } catch (error) {
      console.error('Error initializing Paystack transaction:', error);
      return {
        status: false,
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static async verifyTransaction(reference: string): Promise<PaystackResponse> {
    try {
      const result = await trpcClient.payments.paystack.verify.mutate({ reference });
      return result as PaystackResponse;
    } catch (error) {
      console.error('Error verifying Paystack transaction:', error);
      return {
        status: false,
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static getPaymentUrl(accessCode: string): string {
    return `https://checkout.paystack.com/${accessCode}`;
  }
}
