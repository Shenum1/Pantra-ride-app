const FLUTTERWAVE_PUBLIC_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '';
const FLUTTERWAVE_SECRET_KEY = process.env.EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY || '';

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
      if (!FLUTTERWAVE_SECRET_KEY) {
        console.warn('⚠️ Flutterwave Secret Key is not configured');
        return {
          status: 'error',
          message: 'Flutterwave is not configured. Please add EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY to your environment variables.',
        };
      }

      const tx_ref = data.tx_ref || this.generateReference();

      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref,
          amount: data.amount,
          currency: data.currency || 'NGN',
          redirect_url: data.redirect_url || 'https://rork.app/payment-callback',
          payment_options: data.payment_options || 'card,banktransfer,ussd,mobilemoney',
          customer: {
            email: data.email,
            phonenumber: data.phone_number,
            name: data.name || 'Customer',
          },
          customizations: {
            title: 'Ride Payment',
            description: 'Payment for ride service',
            logo: 'https://rork.app/logo.png',
          },
          meta: data.meta,
        }),
      });

      const result = await response.json();

      if (result.status !== 'success') {
        console.error('Flutterwave initialization failed:', result);
        return {
          status: 'error',
          message: result.message || 'Failed to initialize payment',
          data: result,
        };
      }

      console.log('✅ Flutterwave payment initialized:', tx_ref);
      return {
        status: 'success',
        message: 'Payment initialized successfully',
        data: result.data,
      };
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
      if (!FLUTTERWAVE_SECRET_KEY) {
        console.warn('⚠️ Flutterwave Secret Key is not configured');
        return {
          status: 'error',
          message: 'Flutterwave is not configured',
        };
      }

      const isReference = transactionIdOrReference.startsWith('FLW-') || transactionIdOrReference.startsWith('PANTRA-');
      const verifyUrl = isReference
        ? `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionIdOrReference)}`
        : `https://api.flutterwave.com/v3/transactions/${transactionIdOrReference}/verify`;

      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      });

      const result = await response.json();

      if (result.status !== 'success') {
        console.error('Flutterwave verification failed:', result);
        return {
          status: 'error',
          message: result.message || 'Failed to verify payment',
          data: result,
        };
      }

      console.log('✅ Flutterwave transaction verified:', transactionIdOrReference);
      return {
        status: 'success',
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error('Error verifying Flutterwave transaction:', error);
      return {
        status: 'error',
        message: 'Network error. Please check your connection.',
      };
    }
  }

  static async getBanks(country: string = 'NG'): Promise<FlutterwaveResponse> {
    try {
      if (!FLUTTERWAVE_SECRET_KEY) {
        return {
          status: 'error',
          message: 'Flutterwave is not configured',
        };
      }

      const response = await fetch(`https://api.flutterwave.com/v3/banks/${country}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching banks:', error);
      return {
        status: 'error',
        message: 'Failed to fetch banks',
      };
    }
  }

  static getPaymentUrl(link: string): string {
    return link;
  }
}
