import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// verifyPaystackTransaction / verifyFlutterwaveTransaction are the single
// place payment-provider verification happens (both the public
// payments.*.verify routes and the authed payments.wallet.credit route call
// them) — these tests are the regression guard for that logic, especially
// the Flutterwave bug this audit fixed: the outer `status: "success"` field
// only means the API call itself succeeded, not that the charge did.

const originalPaystackKey = process.env.PAYSTACK_SECRET_KEY;
const originalFlutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack';
  process.env.FLUTTERWAVE_SECRET_KEY = 'sk_test_flutterwave';
  vi.resetModules();
});

afterEach(() => {
  process.env.PAYSTACK_SECRET_KEY = originalPaystackKey;
  process.env.FLUTTERWAVE_SECRET_KEY = originalFlutterwaveKey;
  vi.unstubAllGlobals();
});

describe('verifyPaystackTransaction', () => {
  it('reports success and converts the confirmed amount from kobo to naira', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { status: 'success', amount: 500000, currency: 'NGN' } }),
      })
    );
    const { verifyPaystackTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyPaystackTransaction('TXN-1');

    expect(result.success).toBe(true);
    expect(result.amount).toBe(5000);
  });

  it('reports failure when the transaction status is not "success", with no amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { status: 'failed', amount: 500000 } }),
      })
    );
    const { verifyPaystackTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyPaystackTransaction('TXN-2');

    expect(result.success).toBe(false);
    expect(result.amount).toBeNull();
  });

  it('fails closed when PAYSTACK_SECRET_KEY is not configured', async () => {
    process.env.PAYSTACK_SECRET_KEY = '';
    const { verifyPaystackTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyPaystackTransaction('TXN-3');

    expect(result.success).toBe(false);
    expect(result.amount).toBeNull();
  });
});

describe('verifyFlutterwaveTransaction', () => {
  it('reports success only when data.status is "successful"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { status: 'successful', amount: 5000, currency: 'NGN' } }),
      })
    );
    const { verifyFlutterwaveTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyFlutterwaveTransaction('FLW-1');

    expect(result.success).toBe(true);
    expect(result.amount).toBe(5000);
  });

  it('reports failure when the outer API call succeeded but the charge itself failed', async () => {
    // This is the exact bug this audit fixed: outer status:"success" (the
    // API call worked) with an underlying failed charge must NOT be treated
    // as a successful payment.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { status: 'failed', amount: 5000 } }),
      })
    );
    const { verifyFlutterwaveTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyFlutterwaveTransaction('FLW-2');

    expect(result.success).toBe(false);
    expect(result.amount).toBeNull();
  });

  it('reports failure when the outer API call itself failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', message: 'transaction not found' }),
      })
    );
    const { verifyFlutterwaveTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyFlutterwaveTransaction('FLW-3');

    expect(result.success).toBe(false);
    expect(result.amount).toBeNull();
  });

  it('fails closed on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { verifyFlutterwaveTransaction } = await import('@/backend/lib/payment-providers');

    const result = await verifyFlutterwaveTransaction('FLW-4');

    expect(result.success).toBe(false);
    expect(result.amount).toBeNull();
  });
});
