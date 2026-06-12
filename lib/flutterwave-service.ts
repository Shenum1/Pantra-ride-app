import { trpcClient } from './trpc';

export interface FlutterwavePaymentData {
  amount: number;
  email: string;
  phone_number?: string;
  name?: string;
  tx_ref?: string;
  currency?: string;
  redirect_url?: string;
  payment_options?: string;
  meta?: Record<string, any>;
}

export interface FlutterwaveResponse {
  status: string;
  message: string;
  data?: any;
}

export class FlutterwaveService {
  static generateReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `FLW-${timestamp}-${random}`;
  }

  static async initializePayment(data: FlutterwavePaymentData): Promise<FlutterwaveResponse> {
    try {
      const result = await trpcClient.payments.flutterwave.initialize.mutate({
        amount: data.amount,
        email: data.email,
        phone_number: data.phone_number,
        name: data.name,
        tx_ref: data.tx_ref,
        redirect_url: data.redirect_url,
        meta: data.meta,
      });

      return result as FlutterwaveResponse;
    } catch (error) {
      console.error('Error initializing Flutterwave payment:', error);
      return {
        status: 'error',
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static async verifyTransaction(transactionIdOrReference: string): Promise<FlutterwaveResponse> {
    try {
      const result = await trpcClient.payments.flutterwave.verify.mutate({
        transactionIdOrReference,
      });

      return result as FlutterwaveResponse;
    } catch (error) {
      console.error('Error verifying Flutterwave transaction:', error);
      return {
        status: 'error',
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static getPaymentUrl(link: string): string {
    return link;
  }
}
