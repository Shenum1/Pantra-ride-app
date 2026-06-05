import { DatabaseService } from './database-service';
import { calculateFare } from './fare-calculator';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  paymentMethodId: string;
  userId: string;
  rideId: string;
  createdAt: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'cash' | 'wallet';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export class PaymentService {
  static async createPaymentIntent(
    userId: string,
    rideId: string,
    amount: number,
    paymentMethodId: string
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent: Omit<PaymentIntent, 'id'> = {
        amount,
        currency: 'NGN',
        status: 'pending',
        paymentMethodId,
        userId,
        rideId,
        createdAt: new Date(),
      };

      const id = await DatabaseService.create('payment_intents', paymentIntent);

      return { id, ...paymentIntent };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  static async processPayment(paymentIntentId: string): Promise<boolean> {
    try {
      await DatabaseService.update('payment_intents', paymentIntentId, {
        status: 'processing',
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const success = Math.random() > 0.1;

      await DatabaseService.update('payment_intents', paymentIntentId, {
        status: success ? 'succeeded' : 'failed',
      });

      return success;
    } catch (error) {
      console.error('Error processing payment:', error);
      await DatabaseService.update('payment_intents', paymentIntentId, {
        status: 'failed',
      });
      return false;
    }
  }

  static async addPaymentMethod(
    userId: string,
    paymentMethod: Omit<PaymentMethod, 'id'>
  ): Promise<string> {
    try {
      const existingMethods = await DatabaseService.query('payment_methods', [
        { field: 'userId', operator: '==', value: userId },
      ]);

      const isFirstMethod = existingMethods.length === 0;

      const methodData = {
        ...paymentMethod,
        userId,
        isDefault: isFirstMethod || paymentMethod.isDefault,
      };

      if (paymentMethod.isDefault && !isFirstMethod) {
        for (const method of existingMethods) {
          await DatabaseService.update('payment_methods', method.id, {
            isDefault: false,
          });
        }
      }

      const id = await DatabaseService.create('payment_methods', methodData);
      return id;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  }

  static async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const methods = await DatabaseService.query('payment_methods', [
        { field: 'userId', operator: '==', value: userId },
      ]);
      return methods as PaymentMethod[];
    } catch (error) {
      console.error('Error getting payment methods:', error);
      return [];
    }
  }

  static async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      const methods = await this.getPaymentMethods(userId);

      for (const method of methods) {
        await DatabaseService.update('payment_methods', method.id, {
          isDefault: method.id === paymentMethodId,
        });
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  }

  static async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await DatabaseService.delete('payment_methods', paymentMethodId);
    } catch (error) {
      console.error('Error removing payment method:', error);
      throw error;
    }
  }

  static async refundPayment(paymentIntentId: string): Promise<boolean> {
    try {
      const paymentIntent = await DatabaseService.get(
        'payment_intents',
        paymentIntentId
      );

      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      await DatabaseService.create('refunds', {
        paymentIntentId,
        amount: (paymentIntent as any).amount,
        status: 'succeeded',
        reason: 'requested_by_customer',
      });

      return true;
    } catch (error) {
      console.error('Error refunding payment:', error);
      return false;
    }
  }

  static calculateFare(
    distanceKm: number,
    durationMin: number,
    rideType: string,
    surgeMultiplier: number = 1.0
  ): number {
    return calculateFare(distanceKm, durationMin, rideType, surgeMultiplier);
  }

  static async getPaymentHistory(userId: string): Promise<PaymentIntent[]> {
    try {
      const payments = await DatabaseService.query(
        'payment_intents',
        [{ field: 'userId', operator: '==', value: userId }],
        'createdAt',
        'desc',
        50
      );
      return payments as PaymentIntent[];
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  }
}
