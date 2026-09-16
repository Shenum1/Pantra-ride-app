import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('payout-provider (Paystack Transfers)', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PAYSTACK_SECRET_KEY;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_payout_provider_tests';
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PAYSTACK_SECRET_KEY = originalKey;
  });

  it('createPaystackTransferRecipient returns the recipient code on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'ok', data: { recipient_code: 'RCP_abc123', details: { account_name: 'Jane Driver' } } }),
    }) as any;
    const { createPaystackTransferRecipient } = await import('@/backend/lib/payout-provider');

    const result = await createPaystackTransferRecipient({ accountNumber: '0123456789', bankCode: '058', accountName: 'Jane Driver' });

    expect(result.ok).toBe(true);
    expect(result.recipientCode).toBe('RCP_abc123');
    const [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body)).toMatchObject({ type: 'nuban', bank_code: '058', account_number: '0123456789', currency: 'NGN' });
  });

  it('initiatePaystackTransfer converts naira to kobo and never marks completed from the initiation response alone', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'ok', data: { transfer_code: 'TRF_xyz', status: 'success' } }),
    }) as any;
    const { initiatePaystackTransfer } = await import('@/backend/lib/payout-provider');

    const result = await initiatePaystackTransfer({ amount: 5000, recipientCode: 'RCP_abc123', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('created');
    expect(result.providerTransferCode).toBe('TRF_xyz');
    const [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(requestInit.body).amount).toBe(500000); // 5000 naira -> 500000 kobo
  });

  it('detects a duplicate-reference rejection distinctly from a generic rejection', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ status: false, message: 'Duplicate Transfer Reference' }),
    }) as any;
    const { initiatePaystackTransfer } = await import('@/backend/lib/payout-provider');

    const result = await initiatePaystackTransfer({ amount: 5000, recipientCode: 'RCP_abc123', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('duplicate_reference');
  });

  it('a network exception is reported as outcome "network_error", never as a confirmed failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed')) as any;
    const { initiatePaystackTransfer } = await import('@/backend/lib/payout-provider');

    const result = await initiatePaystackTransfer({ amount: 5000, recipientCode: 'RCP_abc123', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('network_error');
    expect(result.providerState).toBe('unknown');
  });

  it('verifyPaystackTransfer maps provider statuses to normalized states, including OTP as pending', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'ok', data: { status: 'otp', amount: 500000, transfer_code: 'TRF_1' } }),
    }) as any;
    const { verifyPaystackTransfer } = await import('@/backend/lib/payout-provider');

    const result = await verifyPaystackTransfer('PANTRA-PAYOUT-1');

    expect(result.found).toBe(true);
    expect(result.providerState).toBe('pending');
    expect(result.amount).toBe(5000); // kobo -> naira
  });

  it('verifyPaystackTransfer reports not found rather than throwing when Paystack has no record', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: false, message: 'Transfer not found' }),
    }) as any;
    const { verifyPaystackTransfer } = await import('@/backend/lib/payout-provider');

    const result = await verifyPaystackTransfer('PANTRA-PAYOUT-does-not-exist');

    expect(result.found).toBe(false);
  });

  it('generatePayoutReference produces a distinct, prefixed reference every call', async () => {
    const { generatePayoutReference } = await import('@/backend/lib/payout-provider');
    const a = generatePayoutReference();
    const b = generatePayoutReference();
    expect(a).toMatch(/^PANTRA-PAYOUT-/);
    expect(a).not.toBe(b);
  });
});
