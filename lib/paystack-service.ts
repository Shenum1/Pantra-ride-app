const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || '';

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
      if (!PAYSTACK_SECRET_KEY) {
        console.warn('⚠️ Paystack Secret Key is not configured');
        return {
          status: false,
          message: 'Paystack is not configured. Please add EXPO_PUBLIC_PAYSTACK_SECRET_KEY to your environment variables.',
        };
      }

      const reference = data.reference || this.generateReference();
      const amountInKobo = Math.round(data.amount * 100);

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          amount: amountInKobo,
          reference,
          currency: data.currency || 'NGN',
          channels: data.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
          metadata: {
            ...data.metadata,
            cancel_action: data.callback_url || 'https://rork.app/payment-cancel',
          },
          callback_url: data.callback_url,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Paystack initialization failed:', result);
        return {
          status: false,
          message: result.message || 'Failed to initialize payment',
          data: result,
        };
      }

      console.log('✅ Paystack transaction initialized:', reference);
      return {
        status: true,
        message: 'Transaction initialized successfully',
        data: result.data,
      };
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
      if (!PAYSTACK_SECRET_KEY) {
        console.warn('⚠️ Paystack Secret Key is not configured');
        return {
          status: false,
          message: 'Paystack is not configured',
        };
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Paystack verification failed:', result);
        return {
          status: false,
          message: result.message || 'Failed to verify payment',
          data: result,
        };
      }

      console.log('✅ Paystack transaction verified:', reference);
      return {
        status: result.data.status === 'success',
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error('Error verifying Paystack transaction:', error);
      return {
        status: false,
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static async createSubaccount(data: {
    business_name: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
  }): Promise<PaystackResponse> {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        return {
          status: false,
          message: 'Paystack is not configured',
        };
      }

      const response = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating Paystack subaccount:', error);
      return {
        status: false,
        message: 'Failed to create subaccount',
      };
    }
  }

  static getPaymentUrl(accessCode: string): string {
    return `https://checkout.paystack.com/${accessCode}`;
  }
}
