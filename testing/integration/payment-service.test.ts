import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/database-service', () => ({
  DatabaseService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
  },
}));

import { DatabaseService } from '@/lib/database-service';
import { PaymentService } from '@/lib/payment-service';

describe('WAT Agent 1 — Payment Service (TC-2.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pure function: fare calculation ───────────────────────────────────
  describe('calculateFare — pure utility', () => {
    it('TC-2.5.F1 PASS — standard fare calculated correctly', () => {
      // base=5, perKm=1.5, perMin=0.3, distance=10km, duration=15min
      const fare = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      // 5 + 10*1.5 + 15*0.3 = 5 + 15 + 4.5 = 24.5
      expect(fare).toBe(24.5);
    });

    it('TC-2.5.F2 PASS — premium fare is higher than standard for same trip', () => {
      const standard = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      const premium = PaymentService.calculateFare(10, 15, 'premium', 1.0);
      expect(premium).toBeGreaterThan(standard);
    });

    it('TC-2.5.F3 PASS — xl fare is between standard and premium', () => {
      const standard = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      const xl = PaymentService.calculateFare(10, 15, 'xl', 1.0);
      const premium = PaymentService.calculateFare(10, 15, 'premium', 1.0);
      expect(xl).toBeGreaterThan(standard);
      expect(xl).toBeLessThan(premium);
    });

    it('TC-2.5.F4 PASS — surge multiplier scales fare proportionally', () => {
      const base = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      const surged = PaymentService.calculateFare(10, 15, 'standard', 2.0);
      expect(surged).toBe(base * 2);
    });

    it('TC-2.5.F5 PASS — unknown ride type falls back to standard rates', () => {
      const standard = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      const unknown = PaymentService.calculateFare(10, 15, 'unicorn', 1.0);
      expect(unknown).toBe(standard);
    });

    it('TC-2.5.F6 PASS — fare is rounded to 2 decimal places', () => {
      const fare = PaymentService.calculateFare(7, 11, 'standard', 1.0);
      const decimals = (fare.toString().split('.')[1] ?? '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('TC-2.5.F7 PASS — shared fare is cheapest option', () => {
      const shared = PaymentService.calculateFare(10, 15, 'shared', 1.0);
      const standard = PaymentService.calculateFare(10, 15, 'standard', 1.0);
      expect(shared).toBeLessThan(standard);
    });
  });

  // ── TC-2.5 Payment flow ───────────────────────────────────────────────
  describe('createPaymentIntent', () => {
    it('TC-2.5.1 PASS — creates payment intent with correct fields', async () => {
      vi.mocked(DatabaseService.create).mockResolvedValue('pi-001');

      const intent = await PaymentService.createPaymentIntent('user-1', 'ride-1', 24.5, 'pm-card-001');

      expect(intent.id).toBe('pi-001');
      expect(intent.amount).toBe(24.5);
      expect(intent.status).toBe('pending');
      expect(intent.userId).toBe('user-1');
      expect(intent.rideId).toBe('ride-1');
    });

    it('TC-2.5.2 PASS — throws when database create fails', async () => {
      vi.mocked(DatabaseService.create).mockRejectedValue(new Error('DB write failed'));

      await expect(
        PaymentService.createPaymentIntent('user-1', 'ride-1', 24.5, 'pm-001'),
      ).rejects.toThrow('DB write failed');
    });
  });

  describe('processPayment', () => {
    it('TC-2.5.3 PASS — transitions through processing then succeeded/failed', async () => {
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      const result = await PaymentService.processPayment('pi-001');

      expect(typeof result).toBe('boolean');
      expect(DatabaseService.update).toHaveBeenCalledWith('payment_intents', 'pi-001', { status: 'processing' });
    });

    it('TC-2.5.4 PASS — marks payment as failed on DB error, returns false', async () => {
      vi.mocked(DatabaseService.update)
        .mockResolvedValueOnce(undefined) // processing
        .mockRejectedValueOnce(new Error('network timeout')) // simulate failure during await
        .mockResolvedValueOnce(undefined); // failed update

      const result = await PaymentService.processPayment('pi-002');
      expect(result).toBe(false);
    });
  });

  describe('addPaymentMethod', () => {
    it('TC-2.5.5 PASS — first method added becomes default', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]); // no existing methods
      vi.mocked(DatabaseService.create).mockResolvedValue('pm-new-001');

      const id = await PaymentService.addPaymentMethod('user-1', {
        type: 'card',
        last4: '4242',
        brand: 'visa',
        isDefault: false,
      });

      expect(id).toBe('pm-new-001');
      expect(DatabaseService.create).toHaveBeenCalledWith(
        'payment_methods',
        expect.objectContaining({ isDefault: true }),
      );
    });

    it('TC-2.5.6 PASS — second method with isDefault=true demotes previous default', async () => {
      const existingMethod = { id: 'pm-old', isDefault: true };
      vi.mocked(DatabaseService.query).mockResolvedValue([existingMethod]);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);
      vi.mocked(DatabaseService.create).mockResolvedValue('pm-new-002');

      await PaymentService.addPaymentMethod('user-1', {
        type: 'card',
        last4: '1234',
        isDefault: true,
      });

      expect(DatabaseService.update).toHaveBeenCalledWith(
        'payment_methods',
        'pm-old',
        { isDefault: false },
      );
    });
  });

  describe('refundPayment', () => {
    it('TC-2.5.7 PASS — creates refund record for succeeded payment', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue({
        id: 'pi-001',
        amount: 24.5,
        status: 'succeeded',
      });
      vi.mocked(DatabaseService.create).mockResolvedValue('ref-001');

      const result = await PaymentService.refundPayment('pi-001');

      expect(result).toBe(true);
      expect(DatabaseService.create).toHaveBeenCalledWith(
        'refunds',
        expect.objectContaining({
          paymentIntentId: 'pi-001',
          amount: 24.5,
          status: 'succeeded',
        }),
      );
    });

    it('TC-2.5.8 PASS — returns false when payment intent not found', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue(null);

      const result = await PaymentService.refundPayment('ghost-pi');

      expect(result).toBe(false);
    });
  });

  describe('getPaymentMethods', () => {
    it('TC-2.5.9 PASS — returns list of user payment methods', async () => {
      const methods = [
        { id: 'pm-1', type: 'card', last4: '4242', isDefault: true },
        { id: 'pm-2', type: 'wallet', isDefault: false },
      ];
      vi.mocked(DatabaseService.query).mockResolvedValue(methods);

      const result = await PaymentService.getPaymentMethods('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].isDefault).toBe(true);
    });

    it('TC-2.5.10 PASS — returns empty array when no methods saved', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]);

      const result = await PaymentService.getPaymentMethods('user-new');

      expect(result).toHaveLength(0);
    });
  });
});
